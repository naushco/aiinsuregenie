// src/database.js — Database schema and queries
// Uses better-sqlite3 for development. Swap to PostgreSQL + knex for production.

const path = require("path");
const fs = require("fs");

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const Database = require("better-sqlite3");
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "leads.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// SCHEMA
// ============================================================
function migrate() {
  db.exec(`
    -- Core leads table
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'new',
      
      -- PII
      first_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      
      -- Profile
      zip TEXT,
      state TEXT,
      age INTEGER,
      vehicle_year TEXT,
      vehicle_make TEXT,
      coverage TEXT,
      driving_record TEXT,
      currently_insured TEXT,
      current_insurer TEXT,
      homeowner TEXT,
      military TEXT,
      multi_car TEXT,
      priority TEXT,
      
      -- Source tracking
      publisher_id TEXT,
      sub_id TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      ip_address TEXT,
      user_agent TEXT,
      landing_page TEXT,
      
      -- Distribution results
      distribution_mode TEXT,
      total_revenue REAL DEFAULT 0,
      buyers_accepted INTEGER DEFAULT 0,
      buyers_rejected INTEGER DEFAULT 0,
      
      -- Call request (if user requested agent callback)
      call_requested INTEGER DEFAULT 0,
      preferred_call_time TEXT
    );

    -- TCPA Consent log (immutable, never delete)
    CREATE TABLE IF NOT EXISTS consent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      consent_text TEXT NOT NULL,
      consent_timestamp TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      disclosed_buyers TEXT NOT NULL,
      checkbox_checked INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Buyer responses for each lead
    CREATE TABLE IF NOT EXISTS buyer_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      buyer_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      
      -- Ping phase
      ping_sent_at TEXT,
      ping_response TEXT,
      ping_bid REAL,
      ping_accepted INTEGER,
      ping_duration_ms INTEGER,
      
      -- Post phase
      post_sent_at TEXT,
      post_response TEXT,
      post_accepted INTEGER,
      post_lead_id TEXT,
      post_payout REAL,
      post_duration_ms INTEGER,
      post_reject_reason TEXT,
      
      -- Final status
      status TEXT NOT NULL DEFAULT 'pending',
      final_payout REAL DEFAULT 0,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Duplicate detection index
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_publisher ON leads(publisher_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_buyer_responses_lead ON buyer_responses(lead_id);
    CREATE INDEX IF NOT EXISTS idx_buyer_responses_buyer ON buyer_responses(buyer_id);

    -- Revenue tracking view
    CREATE VIEW IF NOT EXISTS revenue_summary AS
    SELECT 
      date(l.created_at) as date,
      l.publisher_id,
      COUNT(DISTINCT l.id) as total_leads,
      SUM(CASE WHEN l.status = 'sold' THEN 1 ELSE 0 END) as sold_leads,
      SUM(l.total_revenue) as total_revenue,
      AVG(l.total_revenue) as avg_revenue_per_lead,
      SUM(l.buyers_accepted) as total_accepts,
      SUM(l.buyers_rejected) as total_rejects
    FROM leads l
    GROUP BY date(l.created_at), l.publisher_id;

    -- Buyer performance view
    CREATE VIEW IF NOT EXISTS buyer_performance AS
    SELECT 
      br.buyer_id,
      br.buyer_name,
      date(br.created_at) as date,
      COUNT(*) as total_pings,
      SUM(CASE WHEN br.ping_accepted = 1 THEN 1 ELSE 0 END) as ping_accepts,
      SUM(CASE WHEN br.post_accepted = 1 THEN 1 ELSE 0 END) as post_accepts,
      SUM(br.final_payout) as total_payout,
      AVG(br.ping_bid) as avg_bid,
      AVG(br.ping_duration_ms) as avg_ping_ms,
      AVG(br.post_duration_ms) as avg_post_ms
    FROM buyer_responses br
    GROUP BY br.buyer_id, br.buyer_name, date(br.created_at);
  `);
  
  console.log("Database migrated successfully at:", DB_PATH);
}

// ============================================================
// QUERIES
// ============================================================
const queries = {
  // Insert new lead
  insertLead: db.prepare(`
    INSERT INTO leads (id, first_name, phone, email, zip, state, age, vehicle_year, vehicle_make,
      coverage, driving_record, currently_insured, current_insurer, homeowner, military, multi_car,
      priority, publisher_id, sub_id, utm_source, utm_medium, utm_campaign, ip_address, user_agent,
      landing_page, distribution_mode, call_requested, preferred_call_time)
    VALUES (@id, @first_name, @phone, @email, @zip, @state, @age, @vehicle_year, @vehicle_make,
      @coverage, @driving_record, @currently_insured, @current_insurer, @homeowner, @military, @multi_car,
      @priority, @publisher_id, @sub_id, @utm_source, @utm_medium, @utm_campaign, @ip_address, @user_agent,
      @landing_page, @distribution_mode, @call_requested, @preferred_call_time)
  `),

  // Log consent
  insertConsent: db.prepare(`
    INSERT INTO consent_log (lead_id, consent_text, consent_timestamp, ip_address, user_agent, disclosed_buyers)
    VALUES (@lead_id, @consent_text, @consent_timestamp, @ip_address, @user_agent, @disclosed_buyers)
  `),

  // Insert buyer response
  insertBuyerResponse: db.prepare(`
    INSERT INTO buyer_responses (lead_id, buyer_id, buyer_name, status)
    VALUES (@lead_id, @buyer_id, @buyer_name, 'pending')
  `),

  // Update ping result
  updatePing: db.prepare(`
    UPDATE buyer_responses 
    SET ping_sent_at = @ping_sent_at, ping_response = @ping_response, ping_bid = @ping_bid,
        ping_accepted = @ping_accepted, ping_duration_ms = @ping_duration_ms, status = @status
    WHERE lead_id = @lead_id AND buyer_id = @buyer_id
  `),

  // Update post result
  updatePost: db.prepare(`
    UPDATE buyer_responses 
    SET post_sent_at = @post_sent_at, post_response = @post_response, post_accepted = @post_accepted,
        post_lead_id = @post_lead_id, post_payout = @post_payout, post_duration_ms = @post_duration_ms,
        post_reject_reason = @post_reject_reason, final_payout = @final_payout, status = @status
    WHERE lead_id = @lead_id AND buyer_id = @buyer_id
  `),

  // Update lead totals
  updateLeadTotals: db.prepare(`
    UPDATE leads 
    SET total_revenue = @total_revenue, buyers_accepted = @buyers_accepted, 
        buyers_rejected = @buyers_rejected, status = @status, updated_at = datetime('now')
    WHERE id = @id
  `),

  // Check duplicates
  findDuplicate: db.prepare(`
    SELECT id, created_at FROM leads 
    WHERE (phone = @phone OR email = @email) 
    AND created_at > datetime('now', @window)
    LIMIT 1
  `),

  // Get lead by ID
  getLeadById: db.prepare("SELECT * FROM leads WHERE id = ?"),

  // Get buyer responses for a lead
  getBuyerResponses: db.prepare("SELECT * FROM buyer_responses WHERE lead_id = ? ORDER BY final_payout DESC"),

  // Dashboard queries
  getRecentLeads: db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?"),
  getDailyRevenue: db.prepare("SELECT * FROM revenue_summary WHERE date >= ? ORDER BY date DESC"),
  getBuyerStats: db.prepare("SELECT * FROM buyer_performance WHERE date >= ? ORDER BY total_payout DESC"),
  
  getTotalStats: db.prepare(`
    SELECT 
      COUNT(*) as total_leads,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_leads,
      SUM(total_revenue) as total_revenue,
      AVG(total_revenue) as avg_rpl,
      SUM(buyers_accepted) as total_accepts,
      SUM(buyers_rejected) as total_rejects
    FROM leads WHERE created_at >= ?
  `),
};

// Run migration if called directly
if (process.argv.includes("--migrate")) {
  migrate();
  process.exit(0);
}
migrate();
module.exports = { db, migrate, queries };
