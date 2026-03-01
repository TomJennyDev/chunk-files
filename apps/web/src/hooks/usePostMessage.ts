import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  createSingleMessageHandler,
  createMultipleMessageHandler,
  isValidMessage,
  type MessageHandler,
  type MessageValidationOptions,
} from '../utils/messageHandlers';

/**
 * Union type defining all possible message types that can be sent between windows.
 * 
 * @example
 * ```tsx
 * const message: Message = { type: 'markdown-content', payload: '# Hello' };
 * ```
 */
export type Message =
  | { type: 'iframe-ready'; payload?: null }
  | { type: 'markdown-content'; payload: string }
  | { type: 'resize'; payload: number }
  | { type: 'heading-visible'; payload: string }
  | { type: 'scrollToHeading'; payload: string }
  | { type: 'scrollToHeadingFromIframe'; payload: string }
  | { type: 'highlightText'; payload: string };


/**
 * Hook for sending type-safe messages to another window (parent or iframe).
 * 
 * @param targetWindow - The target window to send messages to (can be null if not ready yet)
 * @param defaultTargetOrigin - Default target origin for messages (defaults to '*')
 * @returns A function to send messages with type checking
 * 
 * @example
 * ```tsx
 * // In iframe - send to parent
 * const sendToParent = useSendMessage(window.parent, 'http://localhost:5173');
 * sendToParent({ type: 'iframe-ready' });
 * sendToParent({ type: 'heading-visible', id: 'section-1' });
 * 
 * // In parent - send to iframe
 * const iframeRef = useRef<HTMLIFrameElement>(null);
 * const sendToIframe = useSendMessage(iframeRef.current?.contentWindow || null);
 * sendToIframe({ type: 'markdown-content', content: '# Hello' });
 * ```
 */
export function useSendMessage(targetWindow: Window | null, defaultTargetOrigin: string = '*') {
  const sendMessage = useCallback(
    <T extends Message>(message: T, targetOrigin?: string) => {
      if (targetWindow) {
        targetWindow.postMessage(message, targetOrigin ?? defaultTargetOrigin);
      }
    },
    [targetWindow, defaultTargetOrigin]
  );

  return sendMessage;
}

/**
 * Hook for listening to a specific message type with type safety.
 * 
 * @template T - The message type to listen for
 * @param type - The message type to listen for
 * @param handler - The function to handle the message
 * @param options - Options for validating message source and origin
 * @param options.sourceWindow - Only accept messages from this window (null to skip validation)
 * @param options.targetOrigin - Only accept messages from this origin ('*' to accept all)
 * 
 * @example
 * ```tsx
 * // Listen for markdown-content from parent
 * useMessageListener('markdown-content', (message, event) => {
 *   console.log('Content:', message.content);
 *   console.log('From:', event.origin);
 * }, {
 *   sourceWindow: window.parent,
 *   targetOrigin: 'http://localhost:5173'
 * });
 * 
 * // Listen for heading-visible from iframe
 * useMessageListener('heading-visible', (message) => {
 *   setActiveId(message.id);
 * });
 * ```
 */
export function useMessageListener<T extends Message['type']>(
  type: T,
  handler: MessageHandler<T>,
  options?: MessageValidationOptions
) {
  // Use ref to avoid re-registering event listener when handler changes
  const handlerRef = useRef(handler);
  
  // Update ref immediately without useEffect to avoid extra renders
  handlerRef.current = handler;

  // Memoize validation options to prevent unnecessary re-renders
  const validationOptions = useMemo(
    () => options,
    [options?.sourceWindow, options?.targetOrigin]
  );

  useEffect(() => {
    const handleMessage = createSingleMessageHandler(
      type,
      (message, event) => handlerRef.current(message, event),
      isValidMessage,
      validationOptions
    );

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [type, validationOptions]);
}

/**
 * Hook for listening to multiple message types simultaneously with type safety.
 * More efficient than calling multiple useMessageListener hooks separately.
 * 
 * @param handlers - Object mapping message types to their handler functions
 * @param options - Options for validating message source and origin
 * @param options.sourceWindow - Only accept messages from this window (null to skip validation)
 * @param options.targetOrigin - Only accept messages from this origin ('*' to accept all)
 * 
 * @example
 * ```tsx
 * // In parent - listen to multiple messages from iframe
 * const iframeRef = useRef<HTMLIFrameElement>(null);
 * 
 * useMultipleMessageListeners({
 *   'resize': (message) => {
 *     if (iframeRef.current) {
 *       iframeRef.current.style.height = `${message.height}px`;
 *     }
 *   },
 *   'iframe-ready': () => {
 *     sendToIframe({ type: 'markdown-content', content: markdownText });
 *   },
 *   'heading-visible': (message, event) => {
 *     setActiveId(message.id);
 *     console.log('From:', event.origin);
 *   }
 * }, {
 *   sourceWindow: iframeRef.current?.contentWindow,
 *   targetOrigin: 'http://localhost:5173'
 * });
 * ```
 */
export function useMultipleMessageListeners(
  handlers: {
    [K in Message['type']]?: MessageHandler<K>;
  },
  options?: MessageValidationOptions
) {
  // Use ref to avoid re-registering event listener when handlers change
  const handlersRef = useRef(handlers);
  
  // Update ref immediately without useEffect to avoid extra renders
  handlersRef.current = handlers;

  // Memoize validation options to prevent unnecessary re-renders
  const validationOptions = useMemo(
    () => options,
    [options?.sourceWindow, options?.targetOrigin]
  );

  useEffect(() => {
    // Create a proxy handler that uses the current ref
    const proxyHandlers = new Proxy({} as typeof handlers, {
      get: (_, prop) => handlersRef.current[prop as Message['type']]
    });
    
    const handleMessage = createMultipleMessageHandler(proxyHandlers, isValidMessage, validationOptions);

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [validationOptions]);
}
