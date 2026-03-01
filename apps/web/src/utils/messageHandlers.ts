import type { Message } from '../hooks/usePostMessage';


/**
 * Constant array of valid message types for runtime validation.
 */
const VALID_MESSAGE_TYPES: ReadonlyArray<Message['type']> = [
  'iframe-ready',
  'markdown-content',
  'resize',
  'heading-visible',
  'scrollToHeading',
  'scrollToHeadingFromIframe',
] as const;

/**
 * Type guard to check if data is a valid Message.
 * 
 * @param data - The data to check
 * @returns `true` if data is a valid Message, `false` otherwise
 * 
 * @example
 * ```tsx
 * if (isValidMessage(event.data)) {
 *   // TypeScript knows event.data is Message
 *   console.log(event.data.type);
 * }
 * ```
 */
export function isValidMessage(data: any): data is Message {
  return (
    data &&
    typeof data === 'object' &&
    'type' in data &&
    VALID_MESSAGE_TYPES.includes(data.type)
  );
}




/**
 * Type for message handler functions.
 * 
 * @template T - The message type to handle
 */
export type MessageHandler<T extends Message['type']> = (
  message: Extract<Message, { type: T }>,
  event: MessageEvent
) => void;

/**
 * Options for message validation.
 */
export interface MessageValidationOptions {
  /** Only accept messages from this window (null to skip validation) */
  sourceWindow?: Window | null;
  /** Only accept messages from this origin ('*' to accept all) */
  targetOrigin?: string;
}

/**
 * Validates message event against specified options.
 * 
 * @param event - The message event to validate
 * @param options - Validation options
 * @returns `true` if message passes validation, `false` otherwise
 * 
 * @example
 * ```tsx
 * if (validateMessageEvent(event, { targetOrigin: 'http://localhost:5173' })) {
 *   // Process message
 * }
 * ```
 */
export function validateMessageEvent(
  event: MessageEvent,
  options?: MessageValidationOptions
): boolean {
  // Validate source window
  if (options?.sourceWindow && event.source !== options.sourceWindow) {
    return false;
  }

  // Validate origin
  if (
    options?.targetOrigin &&
    options.targetOrigin !== '*' &&
    event.origin !== options.targetOrigin
  ) {
    return false;
  }

  return true;
}

/**
 * Creates a message handler for a single message type.
 * 
 * @template T - The message type to handle
 * @param type - The message type to listen for
 * @param handler - The function to handle the message
 * @param validateMessage - Type guard function to check if data is valid
 * @param options - Validation options
 * @returns Event listener function
 * 
 * @example
 * ```tsx
 * const handler = createSingleMessageHandler(
 *   'markdown-content',
 *   (message) => console.log(message.content),
 *   isValidMessage
 * );
 * window.addEventListener('message', handler);
 * ```
 */
export function createSingleMessageHandler<T extends Message['type']>(
  type: T,
  handler: MessageHandler<T>,
  validateMessage: (data: any) => data is Message,
  options?: MessageValidationOptions
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    if (!validateMessageEvent(event, options)) {
      return;
    }

    if (validateMessage(event.data) && event.data.type === type) {
      handler(event.data as Extract<Message, { type: T }>, event);
    }
  };
}

/**
 * Creates a message handler for multiple message types.
 * 
 * @param handlers - Object mapping message types to their handler functions
 * @param validateMessage - Type guard function to check if data is valid
 * @param options - Validation options
 * @returns Event listener function
 * 
 * @example
 * ```tsx
 * const handler = createMultipleMessageHandler(
 *   {
 *     'resize': (message) => console.log(message.height),
 *     'heading-visible': (message) => console.log(message.id)
 *   },
 *   isValidMessage
 * );
 * window.addEventListener('message', handler);
 * ```
 */
export function createMultipleMessageHandler(
  handlers: {
    [K in Message['type']]?: MessageHandler<K>;
  },
  validateMessage: (data: any) => data is Message,
  options?: MessageValidationOptions
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    if (!validateMessageEvent(event, options)) {
      return;
    }

    if (validateMessage(event.data)) {
      const handler = handlers[event.data.type];
      if (handler) {
        handler(event.data as any, event);
      }
    }
  };
}


// ============================================================================
// Non-React utility functions for use outside React lifecycle
// ============================================================================

/**
 * Send a type-safe message to another window (parent or iframe).
 * Use this function outside React components or lifecycle.
 * 
 * @param targetWindow - The target window to send messages to
 * @param message - The message to send
 * @param targetOrigin - Target origin for the message (defaults to '*')
 * 
 * @example
 * ```tsx
 * // Send to parent window
 * sendMessage(window.parent, { type: 'iframe-ready' });
 * sendMessage(window.parent, { type: 'heading-visible', id: 'section-1' }, 'http://localhost:5173');
 * 
 * // Send to iframe
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * sendMessage(iframe.contentWindow, { type: 'markdown-content', content: '# Hello' });
 * ```
 */
export function sendMessage<T extends Message>(
  targetWindow: Window | null,
  message: T,
  targetOrigin: string = '*'
): void {
  if (targetWindow) {
    targetWindow.postMessage(message, targetOrigin);
  }
}

/**
 * Add a listener for a specific message type.
 * Use this function outside React components or lifecycle.
 * 
 * @template T - The message type to listen for
 * @param type - The message type to listen for
 * @param handler - The function to handle the message
 * @param options - Options for validating message source and origin
 * @returns A cleanup function to remove the listener
 * 
 * @example
 * ```tsx
 * // Listen for markdown-content from parent
 * const cleanup = addMessageListener('markdown-content', (message, event) => {
 *   console.log('Content:', message.content);
 *   console.log('From:', event.origin);
 * }, {
 *   sourceWindow: window.parent,
 *   targetOrigin: 'http://localhost:5173'
 * });
 * 
 * // Later, remove the listener
 * cleanup();
 * ```
 */
export function addMessageListener<T extends Message['type']>(
  type: T,
  handler: MessageHandler<T>,
  options?: MessageValidationOptions
): () => void {
  const handleMessage = createSingleMessageHandler(
    type,
    handler,
    isValidMessage,
    options
  );

  window.addEventListener('message', handleMessage);
  
  // Return cleanup function
  return () => window.removeEventListener('message', handleMessage);
}

/**
 * Add listeners for multiple message types simultaneously.
 * Use this function outside React components or lifecycle.
 * More efficient than calling addMessageListener multiple times.
 * 
 * @param handlers - Object mapping message types to their handler functions
 * @param options - Options for validating message source and origin
 * @returns A cleanup function to remove all listeners
 * 
 * @example
 * ```tsx
 * // Listen to multiple messages from iframe
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * 
 * const cleanup = addMultipleMessageListeners({
 *   'resize': (message) => {
 *     iframe.style.height = `${message.height}px`;
 *   },
 *   'iframe-ready': () => {
 *     sendMessage(iframe.contentWindow, { type: 'markdown-content', content: '# Hello' });
 *   },
 *   'heading-visible': (message, event) => {
 *     console.log('Active heading:', message.id);
 *     console.log('From:', event.origin);
 *   }
 * }, {
 *   sourceWindow: iframe.contentWindow,
 *   targetOrigin: 'http://localhost:5173'
 * });
 * 
 * // Later, remove all listeners
 * cleanup();
 * ```
 */
export function addMultipleMessageListeners(
  handlers: {
    [K in Message['type']]?: MessageHandler<K>;
  },
  options?: MessageValidationOptions
): () => void {
  const handleMessage = createMultipleMessageHandler(handlers, isValidMessage, options);

  window.addEventListener('message', handleMessage);
  
  // Return cleanup function
  return () => window.removeEventListener('message', handleMessage);
}
