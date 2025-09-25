import { Pool } from 'pg';

export interface BlockListEntry {
  id: number;
  name: string;
  type: string; // 'person', 'organization', 'entity'
  reason: string;
  severity: number; // 1-10 scale instead of enum
  added_by: string;
  is_active: boolean;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BlockedPayment {
  id?: number;
  payment_id: string;
  receiver_name: string;
  sender_wallet_address?: string;
  receiver_wallet_address?: string;
  amount: number;
  currency: string;
  blocked_reason: string;
  matched_block_list_id?: number;
  blocked_timestamp?: Date;
  payment_metadata?: any;
  webhook_data?: any;
  status: string;
}

export class AIMLBlockService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Check if a payment should be blocked based on receiver name
   */
  async checkPaymentAgainstBlockList(
    receiverName: string,
    paymentData: any
  ): Promise<{ isBlocked: boolean; matchedEntry?: BlockListEntry; reason?: string }> {
    try {
      // Clean and normalize the receiver name for comparison
      const normalizedName = this.normalizeName(receiverName);
      
      // Get all active block list entries
      const query = `
        SELECT * FROM block_list 
        WHERE is_active = true 
        ORDER BY severity DESC, name ASC
      `;
      
      const result = await this.pool.query(query);
      const blockEntries = result.rows as BlockListEntry[];

      // Check for exact and fuzzy matches
      for (const entry of blockEntries) {
        const normalizedBlockName = this.normalizeName(entry.name);
        
        // Exact match
        if (normalizedName === normalizedBlockName) {
          return {
            isBlocked: true,
            matchedEntry: entry,
            reason: `Exact match with blocked entity: ${entry.name} (${entry.reason})`
          };
        }
        
        // Fuzzy match (contains)
        if (normalizedName.includes(normalizedBlockName) || normalizedBlockName.includes(normalizedName)) {
          return {
            isBlocked: true,
            matchedEntry: entry,
            reason: `Fuzzy match with blocked entity: ${entry.name} (${entry.reason})`
          };
        }
        
        // Word-by-word match
        const receiverWords = normalizedName.split(/\s+/);
        const blockWords = normalizedBlockName.split(/\s+/);
        
        let matchCount = 0;
        for (const blockWord of blockWords) {
          if (blockWord.length > 2 && receiverWords.some(word => word.includes(blockWord) || blockWord.includes(word))) {
            matchCount++;
          }
        }
        
        // If more than 60% of words match, consider it a match
        if (matchCount / blockWords.length > 0.6) {
          return {
            isBlocked: true,
            matchedEntry: entry,
            reason: `Partial name match with blocked entity: ${entry.name} (${entry.reason})`
          };
        }
      }

      return { isBlocked: false };
    } catch (error) {
      console.error('Error checking payment against block list:', error);
      // In case of error, allow payment to continue but log the issue
      return { isBlocked: false };
    }
  }

  /**
   * Record a blocked payment
   */
  async recordBlockedPayment(
    paymentId: string,
    senderName: string, // This is actually the sender name we're blocking
    amount: number,
    currency: string,
    blockedReason: string,
    matchedBlockListId?: number,
    paymentMetadata?: any,
    webhookData?: any,
    accountId?: number // Add account ID for the new schema
  ): Promise<number> {
    try {
      const query = `
        INSERT INTO blocked_payments (
          webhook_id, account_id, matched_block_list_id, 
          amount, currency, blocked_reason
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const values = [
        webhookData?.id || paymentId, // webhook_id
        accountId || null, // account_id
        matchedBlockListId, // matched_block_list_id
        amount,
        currency, 
        blockedReason // blocked_reason
      ];

      const result = await this.pool.query(query, values);
      const blockedPaymentId = result.rows[0].id;
      
      console.log(`🚫 AIML BLOCK: Payment ${paymentId} blocked - ${blockedReason} (Sender: ${senderName})`);
      return blockedPaymentId;
    } catch (error) {
      console.error('Error recording blocked payment:', error);
      throw error;
    }
  }

  /**
   * Get all blocked payments with pagination
   */
  async getBlockedPayments(limit: number = 50, offset: number = 0): Promise<BlockedPayment[]> {
    try {
      const query = `
        SELECT bp.*, bl.name as blocked_entity_name, bl.severity
        FROM blocked_payments bp
        LEFT JOIN block_list bl ON bp.matched_block_list_id = bl.id
        ORDER BY bp.blocked_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const result = await this.pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching blocked payments:', error);
      return [];
    }
  }

  /**
   * Get block list entries
   */
  async getBlockList(activeOnly: boolean = true): Promise<BlockListEntry[]> {
    try {
      const query = `
        SELECT * FROM block_list 
        ${activeOnly ? 'WHERE is_active = true' : ''}
        ORDER BY severity DESC, name ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows as BlockListEntry[];
    } catch (error) {
      console.error('Error fetching block list:', error);
      return [];
    }
  }

  /**
   * Add new entry to block list
   */
  async addToBlockList(
    name: string,
    type: string = 'person', // 'person', 'organization', 'entity'
    reason: string,
    severity: number = 8, // 1-10 scale, default 8 for high priority
    addedBy: string = 'ADMIN',
    notes?: string
  ): Promise<number> {
    try {
      const query = `
        INSERT INTO block_list (name, type, reason, severity, added_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const values = [name, type, reason, severity, addedBy, notes];
      const result = await this.pool.query(query, values);
      
      console.log(`📝 Added to block list: ${name} (Severity: ${severity} - ${reason})`);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error adding to block list:', error);
      throw error;
    }
  }

  /**
   * Deactivate a block list entry
   */
  async deactivateBlockEntry(id: number): Promise<boolean> {
    try {
      const query = `UPDATE block_list SET is_active = false WHERE id = $1`;
      await this.pool.query(query, [id]);
      
      console.log(`🔇 Deactivated block list entry: ${id}`);
      return true;
    } catch (error) {
      console.error('Error deactivating block entry:', error);
      return false;
    }
  }

  /**
   * Get blocked payments statistics
   */
  async getBlockedPaymentsStats(): Promise<{
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    bySeverity: Record<string, number>;
  }> {
    try {
      const queries = [
        // Total blocked
        `SELECT COUNT(*) as count FROM blocked_payments`,
        
        // Today
        `SELECT COUNT(*) as count FROM blocked_payments 
         WHERE blocked_at >= CURRENT_DATE`,
        
        // This week
        `SELECT COUNT(*) as count FROM blocked_payments 
         WHERE blocked_at >= date_trunc('week', CURRENT_DATE)`,
        
        // This month
        `SELECT COUNT(*) as count FROM blocked_payments 
         WHERE blocked_at >= date_trunc('month', CURRENT_DATE)`,
        
        // By severity
        `SELECT bl.severity, COUNT(*) as count 
         FROM blocked_payments bp
         LEFT JOIN block_list bl ON bp.matched_block_list_id = bl.id
         WHERE bl.severity IS NOT NULL
         GROUP BY bl.severity`
      ];

      const [total, today, thisWeek, thisMonth, bySeverity] = await Promise.all(
        queries.map(q => this.pool.query(q))
      );

      const severityStats: Record<string, number> = {};
      bySeverity.rows.forEach(row => {
        severityStats[row.severity.toString()] = parseInt(row.count);
      });

      return {
        total: parseInt(total.rows[0].count),
        today: parseInt(today.rows[0].count),
        thisWeek: parseInt(thisWeek.rows[0].count),
        thisMonth: parseInt(thisMonth.rows[0].count),
        bySeverity: severityStats
      };
    } catch (error) {
      console.error('Error getting blocked payments stats:', error);
      return {
        total: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        bySeverity: {}
      };
    }
  }

  /**
   * Normalize name for comparison (remove special chars, convert to lowercase, etc.)
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }
}
