'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface Product {
  id: string;
  name: string;
  sku: string;
  productType: string;
  costPrice: string;
  salePrice: string;
  isActive: boolean;
  category?: {
    name: string;
  };
}

interface ProductFormData {
  name: string;
  productType: string;
  costPrice: string;
  salePrice: string;
  description: string;
}

interface VoiceCommandProps {
  onResults: (products: Product[]) => void;
  onProductCreated?: () => void;
  onShowCreateForm?: (show: boolean) => void;
  onFormDataUpdate?: (data: Partial<ProductFormData>) => void;
  onSubmitProduct?: (data: ProductFormData) => Promise<void>;
}

type ConversationStep = 
  | 'idle' 
  | 'awaiting_name' 
  | 'awaiting_type' 
  | 'awaiting_cost_price' 
  | 'awaiting_sale_price' 
  | 'awaiting_description';

export default function VoiceCommand({ onResults, onProductCreated, onShowCreateForm, onFormDataUpdate, onSubmitProduct }: VoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('');
  
  // FIXED: Using Ref to ensure recognition object is persistent across re-renders and timeouts
  const recognitionRef = useRef<any>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [conversationStep, setConversationStep] = useState<ConversationStep>('idle');
  const conversationStepRef = useRef<ConversationStep>('idle'); 
  
  const [productFormData, setProductFormData] = useState<ProductFormData>({
    name: '',
    productType: 'storable',
    costPrice: '',
    salePrice: '',
    description: '',
  });
  
  // FIXED: Use ref to track form data immediately without React state delay
  const productFormDataRef = useRef<ProductFormData>({
    name: '',
    productType: 'storable',
    costPrice: '',
    salePrice: '',
    description: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onstart = () => {
          console.log('🎤 Recognition STARTED');
          setIsListening(true);
          if (conversationStepRef.current === 'idle') {
            setStatus('Listening... Say your command');
          }
          setTranscript('');
        };

        recognitionInstance.onresult = (event: any) => {
          const speechResult = event.results[0][0].transcript.toLowerCase();
          console.log('🎤 Recognition RESULT:', speechResult);
          setTranscript(speechResult);
          processCommand(speechResult);
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('🎤 Recognition ERROR:', event.error);
          setStatus(`Error: ${event.error}`);
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          console.log('🎤 Recognition ENDED');
          setIsListening(false);
        };

        recognitionRef.current = recognitionInstance;
      } else {
        setStatus('Speech recognition not supported in this browser. Use Chrome or Edge.');
      }

      if (window.speechSynthesis) {
        setSynthesis(window.speechSynthesis);
      }
    }
  }, []);

  useEffect(() => {
    if (conversationStep === 'awaiting_name' && recognitionRef.current) {
      console.log('🎤 Conversation started! Auto-asking first question...');
      const message = 'Product name?';
      setStatus(message);
      speak(message, () => {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('🎤 Failed to start recognition:', e);
          }
        }, 500);
      });
    }
  }, [conversationStep]);

  const fuzzyMatch = (command: string, keywords: string[]): boolean => {
    const words = command.split(' ');
    let matchCount = 0;
    keywords.forEach(keyword => {
      if (words.some(word => word.includes(keyword) || keyword.includes(word))) {
        matchCount++;
      }
    });
    const matchPercentage = (matchCount / keywords.length) * 100;
    return matchPercentage >= 60;
  };

  // FIXED: Added callback to ensure we only start listening AFTER speaking is done
  const speak = (text: string, callback?: () => void) => {
    console.log('🎤 speak() called with text:', text);
    
    // Use window.speechSynthesis directly instead of state
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.3; 
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        if (callback) {
          console.log('🎤 Setting onend callback for speech');
          utterance.onend = () => {
            console.log('🎤 Speech ended, calling callback');
            callback();
          };
        }
        
        window.speechSynthesis.speak(utterance);
        console.log('🎤 window.speechSynthesis.speak() called');
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        // If speech fails, still call callback
        if (callback) {
          console.log('🎤 Speech failed, calling callback anyway');
          callback();
        }
      }
    } else {
      console.warn('🎤 No synthesis available, calling callback immediately');
      if (callback) callback();
    }
  };

  const processCommand = async (command: string) => {
    console.log('🎤 processCommand called with:', command);
    setStatus(`Processing: "${command}"`);

    if (conversationStepRef.current !== 'idle') {
      console.log('🎤 ✅ In conversation mode, handling input');
      await handleConversationalInput(command);
      return;
    }

    if (fuzzyMatch(command, ['system', 'create', 'product']) ||
        fuzzyMatch(command, ['create', 'product']) ||
        command.includes('create') && command.includes('product')) {
      
      // Reset form data ref when starting new conversation
      productFormDataRef.current = {
        name: '',
        productType: 'storable',
        costPrice: '',
        salePrice: '',
        description: '',
      };
      setProductFormData(productFormDataRef.current);
      
      if (onShowCreateForm) {
        onShowCreateForm(true);
      }
      
      conversationStepRef.current = 'awaiting_name';
      setConversationStep('awaiting_name');
      return;
    }

    if (fuzzyMatch(command, ['system', 'get', 'products']) || 
        fuzzyMatch(command, ['system', 'show', 'products']) ||
        fuzzyMatch(command, ['get', 'products']) ||
        fuzzyMatch(command, ['show', 'products'])) {
      setStatus('Fetching all products...');
      speak('Fetching all products');
      await fetchProducts();
      return;
    }

    setStatus('Command not recognized. Try: "Okay system get me all products" or "Okay system create a product"');
  };

  const speakAndListen = (message: string) => {
    console.log('🎤 speakAndListen called with message:', message);
    setStatus(message);
    
    // Fixed: Logic to wait for speech to end before starting the mic
    speak(message, () => {
      console.log('🎤 Speech callback fired, waiting 500ms before starting recognition');
      setTimeout(() => {
        console.log('🎤 Timeout complete, checking recognitionRef:', !!recognitionRef.current);
        if (recognitionRef.current) {
          try {
            console.log('🎤 Starting recognition...');
            recognitionRef.current.start();
            console.log('🎤 Recognition.start() called successfully');
          } catch (e) {
            console.error('🎤 Recognition start error:', e);
          }
        } else {
          console.error('🎤 recognitionRef.current is null!');
        }
      }, 500);
    });
  };

  const handleConversationalInput = async (input: string) => {
    console.log('🎤 Handling conversational input:', input, 'at step:', conversationStepRef.current);

    switch (conversationStepRef.current) {
      case 'awaiting_name':
        // Update both state and ref immediately
        productFormDataRef.current.name = input;
        const newDataWithName = { ...productFormDataRef.current };
        setProductFormData(newDataWithName);
        if (onFormDataUpdate) onFormDataUpdate({ name: input });
        console.log('✅ Name saved in ref:', productFormDataRef.current.name);
        conversationStepRef.current = 'awaiting_type';
        setConversationStep('awaiting_type');
        speakAndListen('Product type? Storable, consumable, or service?');
        break;

      case 'awaiting_type':
        let type = 'storable';
        if (input.includes('consumable')) type = 'consumable';
        else if (input.includes('service')) type = 'service';
        // Update both state and ref immediately
        productFormDataRef.current.productType = type;
        const newDataWithType = { ...productFormDataRef.current };
        setProductFormData(newDataWithType);
        if (onFormDataUpdate) onFormDataUpdate({ productType: type });
        console.log('✅ Type saved in ref:', productFormDataRef.current.productType);
        conversationStepRef.current = 'awaiting_cost_price';
        setConversationStep('awaiting_cost_price');
        speakAndListen('Cost price?');
        break;

      case 'awaiting_cost_price':
        console.log('🎤 Raw input for cost price:', input);
        // Convert words to numbers (e.g., "fifty" -> "50", "one hundred" -> "100")
        let costPrice = input.toLowerCase()
          .replace(/hundred/g, '00')
          .replace(/thousand/g, '000')
          .replace(/one/g, '1')
          .replace(/two/g, '2')
          .replace(/three/g, '3')
          .replace(/four/g, '4')
          .replace(/five/g, '5')
          .replace(/six/g, '6')
          .replace(/seven/g, '7')
          .replace(/eight/g, '8')
          .replace(/nine/g, '9')
          .replace(/ten/g, '10')
          .replace(/twenty/g, '20')
          .replace(/thirty/g, '30')
          .replace(/forty/g, '40')
          .replace(/fifty/g, '50')
          .replace(/sixty/g, '60')
          .replace(/seventy/g, '70')
          .replace(/eighty/g, '80')
          .replace(/ninety/g, '90')
          .replace(/[^0-9.]/g, '');
        
        console.log('🎤 Processed cost price:', costPrice);
        
        if (!costPrice || costPrice === '') {
          console.log('🎤 Cost price is empty, asking again');
          speakAndListen('I did not catch that. Please say the cost price again.');
          return;
        }
        
        // Update both state and ref immediately
        productFormDataRef.current.costPrice = costPrice;
        const newDataWithCost = { ...productFormDataRef.current };
        setProductFormData(newDataWithCost);
        if (onFormDataUpdate) onFormDataUpdate({ costPrice });
        console.log('✅ Cost price saved in ref:', productFormDataRef.current.costPrice);
        conversationStepRef.current = 'awaiting_sale_price';
        setConversationStep('awaiting_sale_price');
        speakAndListen('Sale price?');
        break;

      case 'awaiting_sale_price':
        console.log('🎤 Raw input for sale price:', input);
        let salePrice = input.toLowerCase()
          .replace(/hundred/g, '00')
          .replace(/thousand/g, '000')
          .replace(/one/g, '1')
          .replace(/two/g, '2')
          .replace(/three/g, '3')
          .replace(/four/g, '4')
          .replace(/five/g, '5')
          .replace(/six/g, '6')
          .replace(/seven/g, '7')
          .replace(/eight/g, '8')
          .replace(/nine/g, '9')
          .replace(/ten/g, '10')
          .replace(/twenty/g, '20')
          .replace(/thirty/g, '30')
          .replace(/forty/g, '40')
          .replace(/fifty/g, '50')
          .replace(/sixty/g, '60')
          .replace(/seventy/g, '70')
          .replace(/eighty/g, '80')
          .replace(/ninety/g, '90')
          .replace(/[^0-9.]/g, '');
        
        console.log('🎤 Processed sale price:', salePrice);
        
        if (!salePrice || salePrice === '') {
          console.log('🎤 Sale price is empty, asking again');
          speakAndListen('I did not catch that. Please say the sale price again.');
          return;
        }
        // Update both state and ref immediately
        productFormDataRef.current.salePrice = salePrice;
        const newDataWithSale = { ...productFormDataRef.current };
        setProductFormData(newDataWithSale);
        if (onFormDataUpdate) onFormDataUpdate({ salePrice });
        console.log('✅ Sale price saved in ref:', productFormDataRef.current.salePrice);
        conversationStepRef.current = 'awaiting_description';
        setConversationStep('awaiting_description');
        speakAndListen('Description? Or say skip.');
        break;

      case 'awaiting_description':
        const description = input.includes('skip') ? '' : input;
        // Update both state and ref immediately
        productFormDataRef.current.description = description;
        const finalData = { ...productFormDataRef.current };
        setProductFormData(finalData);
        if (onFormDataUpdate) onFormDataUpdate({ description });
        console.log('✅ Description saved in ref:', productFormDataRef.current.description);
        console.log('✅ Final data from ref:', productFormDataRef.current);
        conversationStepRef.current = 'idle';
        setConversationStep('idle');
        // Use ref data directly to avoid React state timing issues
        await createProduct(productFormDataRef.current);
        break;
    }
  };

  const createProduct = async (data: ProductFormData) => {
    try {
      setStatus('Creating product and generating SKU...');
      speak('Creating product');
      
      const token = getAuthToken();
      
      // Log the data to see what we're sending
      console.log('🔍 Product data before SKU generation:', data);
      console.log('🔍 Product name for SKU:', data.name);
      console.log('🔍 Product name type:', typeof data.name);
      console.log('🔍 Product name trimmed:', data.name?.trim());
      
      const payload = { type: 'product', productName: data.name?.trim() };
      console.log('🔍 SKU API payload:', payload);
      
      const skuResponse = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!skuResponse.ok) {
        const errorData = await skuResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ SKU generation failed:', skuResponse.status, errorData);
        setStatus('❌ Failed to generate SKU');
        speak('Failed to generate SKU');
        resetConversation();
        return;
      }

      const { code: sku } = await skuResponse.json();

      const response = await fetch('/api/erp/inventory/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          sku,
          trackingType: 'none',
          reorderPoint: '0',
          reorderQuantity: '0',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const successMsg = `Product ${data.name} created successfully with SKU ${sku}!`;
        setStatus(`✅ ${successMsg}`);
        speak(successMsg);
        
        setTimeout(async () => {
          await fetchProducts();
          if (onProductCreated) onProductCreated();
        }, 2000);
        
        resetConversation();
      } else {
        const error = await response.json();
        setStatus(`❌ Failed to create product: ${error.error}`);
        speak('Failed to create product');
        resetConversation();
      }
    } catch (error) {
      console.error('🎤 Error creating product:', error);
      setStatus('❌ Error creating product');
      speak('Error creating product');
      resetConversation();
    }
  };

  const resetConversation = () => {
    setConversationStep('idle');
    conversationStepRef.current = 'idle';
    // Reset both state and ref
    const emptyData = {
      name: '',
      productType: 'storable',
      costPrice: '',
      salePrice: '',
      description: '',
    };
    productFormDataRef.current = emptyData;
    setProductFormData(emptyData);
  };

  const fetchProducts = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        onResults(data.products || []);
        setStatus(`✅ Found ${data.products?.length || 0} products!`);
        speak(`Found ${data.products?.length || 0} products`);
      } else {
        setStatus(`❌ Failed to fetch products (${response.status})`);
      }
    } catch (error) {
      setStatus('❌ Error fetching products');
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setStatus('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div className="bg-linear-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            🎤 Voice Commands
          </h3>
          <p className="text-sm text-blue-100 mt-1">
            Click the microphone and speak your command
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all transform hover:scale-110 active:scale-95
            ${isListening 
              ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' 
              : 'bg-white text-blue-600 hover:bg-blue-50'
            }
          `}
        >
          {isListening ? (
            <svg className="w-10 h-10" fill="white" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </button>

        <div className="flex-1">
          {status && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-2">
              <p className="text-sm font-medium">{status}</p>
            </div>
          )}
          {transcript && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">You said:</p>
              <p className="font-medium">"{transcript}"</p>
            </div>
          )}
          {!status && !transcript && conversationStep === 'idle' && (
            <div className="text-sm text-blue-100">
              <p className="font-medium mb-2">📝 Available Commands:</p>
              <ul className="space-y-1 text-xs">
                <li>• "Okay system get me all the products"</li>
                <li>• "Okay system create a product"</li>
              </ul>
            </div>
          )}
          {conversationStep !== 'idle' && (
            <div className="bg-green-500/20 backdrop-blur-sm rounded-lg p-3 mt-2">
              <p className="text-xs text-green-100 mb-1">Creating Product...</p>
              <div className="text-xs space-y-1">
                {productFormData.name && <p>✓ Name: {productFormData.name}</p>}
                {productFormData.productType && <p>✓ Type: {productFormData.productType}</p>}
                {productFormData.costPrice && <p>✓ Cost: ₹{productFormData.costPrice}</p>}
                {productFormData.salePrice && <p>✓ Sale: ₹{productFormData.salePrice}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}