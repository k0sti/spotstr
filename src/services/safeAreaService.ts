import { SafeArea } from 'capacitor-plugin-safe-area';
import { Capacitor } from '@capacitor/core';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

class SafeAreaService {
  private initialized = false;
  private currentInsets: SafeAreaInsets = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };

  async initialize() {
    if (this.initialized) {
      console.log('[SafeAreaService] Already initialized');
      return;
    }

    console.log('[SafeAreaService] Initializing...');

    try {
      if (Capacitor.isNativePlatform()) {
        // Get initial safe area values
        const safeAreaData = await SafeArea.getSafeAreaInsets();
        this.currentInsets = safeAreaData.insets;

        console.log('[SafeAreaService] Initial insets:', this.currentInsets);

        // Apply CSS variables
        this.applyCSSVariables(this.currentInsets);

        // Listen for safe area changes (orientation changes, etc.)
        await SafeArea.addListener('safeAreaChanged', (data) => {
          console.log('[SafeAreaService] Safe area changed:', data.insets);
          this.currentInsets = data.insets;
          this.applyCSSVariables(this.currentInsets);
        });
      } else {
        // For web, use fallback values
        console.log('[SafeAreaService] Web platform - using fallback values');
        this.applyWebFallback();
      }

      this.initialized = true;
      console.log('[SafeAreaService] Initialization complete');
    } catch (error) {
      console.error('[SafeAreaService] Initialization error:', error);
      // Apply fallback values on error
      this.applyWebFallback();
    }
  }

  private applyCSSVariables(insets: SafeAreaInsets) {
    const root = document.documentElement;

    // Apply as CSS custom properties
    root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);

    // Also apply to the viewport meta tag for proper scaling
    this.updateViewportMeta();

    console.log('[SafeAreaService] CSS variables applied:', {
      top: `${insets.top}px`,
      bottom: `${insets.bottom}px`,
      left: `${insets.left}px`,
      right: `${insets.right}px`
    });
  }

  private applyWebFallback() {
    const root = document.documentElement;

    // Use env() with fallback for web
    root.style.setProperty('--safe-area-inset-top',
      'max(env(safe-area-inset-top), 0px)');
    root.style.setProperty('--safe-area-inset-bottom',
      'max(env(safe-area-inset-bottom), 0px)');
    root.style.setProperty('--safe-area-inset-left',
      'max(env(safe-area-inset-left), 0px)');
    root.style.setProperty('--safe-area-inset-right',
      'max(env(safe-area-inset-right), 0px)');
  }

  private updateViewportMeta() {
    let viewport = document.querySelector('meta[name="viewport"]');

    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }

    // Ensure viewport covers the whole screen including safe areas
    viewport.setAttribute('content',
      'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no');
  }

  getInsets(): SafeAreaInsets {
    return this.currentInsets;
  }

  async refresh() {
    if (Capacitor.isNativePlatform()) {
      try {
        const safeAreaData = await SafeArea.getSafeAreaInsets();
        this.currentInsets = safeAreaData.insets;
        this.applyCSSVariables(this.currentInsets);
      } catch (error) {
        console.error('[SafeAreaService] Error refreshing insets:', error);
      }
    }
  }
}

export const safeAreaService = new SafeAreaService();