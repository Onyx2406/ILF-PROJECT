import { Request, Response } from 'express';
import { RafikiService } from '../services/rafikiService';

export class RafikiController {
  // Create wallet address in Rafiki
  static async createWallet(req: Request, res: Response) {
    try {
      console.log('🎯 OC Controller: Received wallet creation request');
      console.log('📝 Request body:', req.body);

      const accountData = req.body;

      // Validate required fields
      if (!accountData.id || !accountData.iban || !accountData.name) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields: id, iban, and name are required'
          }
        });
      }

      // Create wallet in Rafiki
      const walletAddress = await RafikiService.createWalletAddress(accountData);

      console.log('✅ OC Controller: Wallet created successfully in Rafiki');

      res.json({
        success: true,
        data: walletAddress,
        message: 'Wallet address created successfully in Rafiki'
      });

    } catch (error: any) {
      console.error('❌ OC Controller: Error creating wallet in Rafiki:', error);
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to create wallet address in Rafiki'
        }
      });
    }
  }
}
