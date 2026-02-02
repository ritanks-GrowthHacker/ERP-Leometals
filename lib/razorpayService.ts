import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay instance
// Add these to your .env file:
// RAZORPAY_KEY_ID=your_key_id
// RAZORPAY_KEY_SECRET=your_key_secret

// Only initialize Razorpay if credentials are provided
export const razorpayInstance = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

// Create payment order
export async function createRazorpayOrder(amount: number, currency: string = 'INR', receipt: string, notes?: any) {
  if (!razorpayInstance) {
    return {
      success: false,
      error: 'Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.',
    };
  }

  try {
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt,
      notes,
    };

    const order = await razorpayInstance.orders.create(options);
    return {
      success: true,
      order,
    };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Verify payment signature
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(text)
      .digest('hex');

    return generated_signature === signature;
  } catch (error) {
    console.error('Error verifying Razorpay signature:', error);
    return false;
  }
}

// Fetch payment details
export async function fetchPaymentDetails(paymentId: string) {
  if (!razorpayInstance) {
    return {
      success: false,
      error: 'Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.',
    };
  }

  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return {
      success: true,
      payment,
    };
  } catch (error: any) {
    console.error('Error fetching payment details:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Create refund
export async function createRefund(paymentId: string, amount?: number) {
  if (!razorpayInstance) {
    return {
      success: false,
      error: 'Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.',
    };
  }

  try {
    const options: any = {
      payment_id: paymentId,
    };
    
    if (amount) {
      options.amount = amount * 100; // Convert to paise
    }

    const refund = await razorpayInstance.payments.refund(paymentId, options);
    return {
      success: true,
      refund,
    };
  } catch (error: any) {
    console.error('Error creating refund:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
