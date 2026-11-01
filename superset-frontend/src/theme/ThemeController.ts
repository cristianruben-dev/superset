/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  type AnyThemeConfig,
  type SupersetThemeConfig,
  type ThemeControllerOptions,
  type ThemeStorage,
  isThemeConfigDark,
  Theme,
  ThemeMode,
  themeObject as supersetThemeObject,
  normalizeThemeConfig,
} from '@apache-superset/core/theme';
import type {
  BootstrapThemeData,
  BootstrapThemeDataConfig,
} from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';

const STORAGE_KEYS = {
  THEME_MODE: 'superset-theme-mode',
} as const;

const MEDIA_QUERY_DARK_SCHEME = '(prefers-color-scheme: dark)';

export class LocalStorageAdapter implements ThemeStorage {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }
}

export class ThemeController {
  // The controller owns and manages Theme object lifecycles
  private globalTheme: Theme;

  private storage: ThemeStorage;

  private modeStorageKey: string;

  private defaultTheme: AnyThemeConfig | null;

  private darkTheme: AnyThemeConfig | null;

  private systemMode: ThemeMode.DARK | ThemeMode.DEFAULT;

  private currentMode: ThemeMode;

  private onChangeCallbacks: Set<(theme: Theme) => void> = new Set();

  private mediaQuery: MediaQueryList;

  // Track loaded font URLs to avoid duplicate injections
  private loadedFontUrls: Set<string> = new Set();

  private initialMode: ThemeMode | undefined;

  constructor({
    storage = new LocalStorageAdapter(),
    modeStorageKey = STORAGE_KEYS.THEME_MODE,
    themeObject = supersetThemeObject,
    defaultTheme = (supersetThemeObject.theme as AnyThemeConfig) ?? {},
    onChange = undefined,
    initialMode = undefined,
  }: ThemeControllerOptions = {}) {
    this.storage = storage;
    this.modeStorageKey = modeStorageKey;
    this.initialMode = initialMode;

    // Controller creates and owns the global theme
    this.globalTheme = themeObject;

    // Initialize bootstrap data and themes
    const { bootstrapDefaultTheme, bootstrapDarkTheme }: BootstrapThemeData =
      this.loadBootstrapData();

    // Set themes from bootstrap data
    // These will be the THEME_DEFAULT and THEME_DARK from config
    this.defaultTheme = bootstrapDefaultTheme || defaultTheme || null;
    this.darkTheme = bootstrapDarkTheme;

    // Initialize system theme detection
    this.systemMode = ThemeController.getSystemPreferredMode();

    // Only initialize media query listener if OS preference is allowed
    if (this.shouldInitializeMediaQueryListener())
      this.initializeMediaQueryListener();

    // Initialize theme and mode
    this.currentMode = this.determineInitialMode();
    const initialTheme =
      this.getThemeForMode(this.currentMode) || this.defaultTheme || {};

    // Setup change callback
    if (onChange) this.onChangeCallbacks.add(onChange);

    // Apply initial theme with recovery for corrupted stored themes
    try {
      this.applyTheme(initialTheme);
    } catch (error) {
      console.warn('Failed to apply the configured theme:', error);

      // Retry with the default theme
      this.currentMode = ThemeMode.DEFAULT;
      const safeTheme = this.defaultTheme || {};
      this.applyTheme(safeTheme);
    }
    this.persistMode();
  }

  // Public Methods

  /**
   * Cleans up listeners and references. Should be called when the controller is no longer needed.
   */
  public destroy(): void {
    if (this.mediaQuery)
      this.mediaQuery.removeEventListener(
        'change',
        this.handleSystemThemeChange,
      );

    this.onChangeCallbacks.clear();
  }

  /**
   * Check if the user can update the theme.
   * Always true now - theme enforcement is done via THEME_DARK = None
   */
  public canSetTheme(): boolean {
    return true;
  }

  /**
   * Check if the user can update the theme mode.
   * Only possible if dark theme is available
   */
  public canSetMode(): boolean {
    return this.darkTheme !== null;
  }

  /**
   * Returns the current global theme object.
   */
  public getTheme(): Theme {
    return this.globalTheme;
  }

  /**
   * Returns the current theme mode.
   */
  public getCurrentMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * Sets new theme.
   * @param theme - The new theme to apply
   * @throws {Error} If the user does not have permission to update the theme
   */
  public setTheme(theme: AnyThemeConfig): void {
    this.validateThemeUpdatePermission();

    const normalizedTheme = this.normalizeTheme(theme);
    this.currentMode = this.determineInitialMode();

    this.updateTheme(normalizedTheme);
  }

  /**
   * Sets the theme mode (light, dark, or system).
   * @param mode - The new theme mode to apply
   * @throws {Error} If the user does not have permission to update the theme mode
   */
  public setThemeMode(mode: ThemeMode): void {
    this.validateModeUpdatePermission(mode);

    if (this.currentMode === mode) return;

    const theme: AnyThemeConfig | null = this.getThemeForMode(mode);
    if (!theme) {
      this.fallbackToDefaultMode();
      return;
    }

    this.currentMode = mode;
    this.updateTheme(theme);
  }

  /**
   * Resets the theme to the default theme.
   */
  public resetTheme(): void {
    this.currentMode = ThemeMode.DEFAULT;
    const defaultTheme: AnyThemeConfig =
      this.getThemeForMode(ThemeMode.DEFAULT) || this.defaultTheme || {};

    this.updateTheme(defaultTheme);
  }

  /**
   * Checks if OS preference detection is allowed.
   * Allowed when dark theme is available (including base dark theme)
   */
  public canDetectOSPreference(): boolean {
    return this.darkTheme !== null;
  }

  /**
   * Sets an entire new theme configuration, replacing all existing theme data and settings.
   * This method is designed for use cases like embedded dashboards where themes are provided
   * dynamically from external sources.
   * @param config - The complete theme configuration object
   */
  public setThemeConfig(config: SupersetThemeConfig): void {
    this.defaultTheme = config.theme_default;
    this.darkTheme = config.theme_dark || null;

    let newMode: ThemeMode;
    try {
      this.validateModeUpdatePermission(this.currentMode);
      const hasRequiredTheme = this.isValidThemeMode(this.currentMode);
      newMode = hasRequiredTheme
        ? this.currentMode
        : this.determineInitialMode();
    } catch {
      newMode = this.determineInitialMode();
    }

    this.currentMode = newMode;

    const themeToApply =
      this.getThemeForMode(this.currentMode) || this.defaultTheme;

    this.updateTheme(themeToApply);
  }

  /**
   * Handles system theme changes with error recovery.
   */
  private handleSystemThemeChange = (): void => {
    try {
      const newSystemMode: ThemeMode.DEFAULT | ThemeMode.DARK =
        ThemeController.getSystemPreferredMode();

      // Update systemMode regardless of current mode
      const oldSystemMode: ThemeMode.DEFAULT | ThemeMode.DARK = this.systemMode;
      this.systemMode = newSystemMode;

      // Only update theme if currently in SYSTEM mode and the preference changed
      if (
        this.currentMode === ThemeMode.SYSTEM &&
        oldSystemMode !== newSystemMode
      ) {
        const newTheme: AnyThemeConfig | null = this.getThemeForMode(
          ThemeMode.SYSTEM,
        );

        if (newTheme) this.updateTheme(newTheme);
      }
    } catch (error) {
      console.error('Failed to handle system theme change:', error);
    }
  };

  /**
   * Updates the theme.
   * @param theme - The new theme to apply
   */
  private updateTheme(theme?: AnyThemeConfig): void {
    try {
      // If no config provided, use current mode to get theme
      if (!theme) {
        // No theme provided, use the current mode's theme
        const modeTheme =
          this.getThemeForMode(this.currentMode) || this.defaultTheme || {};
        this.applyTheme(modeTheme);
      } else {
        // Theme provided, apply it directly
        this.applyTheme(theme);
      }

      this.persistMode();
      this.notifyListeners();
    } catch (error) {
      this.fallbackToDefaultMode();
    }
  }

  /**
   * Falls back to the default theme when a theme cannot be applied.
   */
  private fallbackToDefaultMode(): void {
    this.currentMode = ThemeMode.DEFAULT;

    const defaultTheme: AnyThemeConfig =
      this.getThemeForMode(ThemeMode.DEFAULT) || this.defaultTheme || {};

    this.applyTheme(defaultTheme);
    this.persistMode();
    this.notifyListeners();
  }

  /**
   * Registers a callback to be called when the theme changes.
   * @param callback - The callback to be called on theme change
   * @returns A function to unsubscribe from the theme change events
   */
  public onChange(callback: (theme: Theme) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  // Private Helper Methods

  /**
   * Determines whether the MediaQueryList listener for system theme changes should be initialized.
   * This checks if both themes are available to enable OS preference detection.
   * @returns {boolean} True if the media query listener should be initialized, false otherwise
   */
  private shouldInitializeMediaQueryListener(): boolean {
    return this.darkTheme !== null;
  }

  /**
   * Initializes media query listeners if OS preference is allowed
   */
  private initializeMediaQueryListener(): void {
    try {
      this.mediaQuery = window.matchMedia(MEDIA_QUERY_DARK_SCHEME);
      this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
    } catch (error) {
      console.warn('Failed to initialize media query listener:', error);
    }
  }

  /**
   * Loads and validates bootstrap theme data.
   */
  private loadBootstrapData(): BootstrapThemeData {
    const {
      common: { theme = {} as BootstrapThemeDataConfig },
    } = getBootstrapData();

    const { default: defaultTheme, dark: darkTheme } = theme;

    const hasValidDefault: boolean = this.isNonEmptyObject(defaultTheme);
    const hasValidDark: boolean = this.isNonEmptyObject(darkTheme);

    // Check if themes have actual custom tokens (not just empty or algorithm-only)
    const hasCustomDefault =
      hasValidDefault && !this.isEmptyTheme(defaultTheme);
    const hasCustomDark = hasValidDark && !this.isEmptyTheme(darkTheme);

    return {
      bootstrapDefaultTheme: hasCustomDefault ? defaultTheme : null,
      bootstrapDarkTheme: hasCustomDark ? darkTheme : null,
      hasCustomThemes: hasCustomDefault || hasCustomDark,
    };
  }

  /**
   * Checks if an object is non-empty (has at least one property).
   */
  private isNonEmptyObject(
    obj: Record<string, any> | undefined | null,
  ): boolean {
    return Boolean(
      obj && typeof obj === 'object' && Object.keys(obj).length > 0,
    );
  }

  /**
   * Checks if a theme is truly empty (not even an algorithm).
   * A theme with just an algorithm is still valid and should be used.
   */
  private isEmptyTheme(theme: AnyThemeConfig | undefined): boolean {
    if (!theme) return true;

    return !(
      theme.algorithm ||
      (theme.token && Object.keys(theme.token).length > 0) ||
      (theme.components && Object.keys(theme.components).length > 0)
    );
  }

  /**
   * Normalizes the theme configuration to ensure it has a valid algorithm.
   * @param theme - The theme configuration to normalize
   * @returns An object with normalized mode and algorithm.
   */
  private normalizeTheme(theme: AnyThemeConfig): AnyThemeConfig {
    const normalizedTheme = normalizeThemeConfig(theme);
    return normalizedTheme;
  }

  /**
   * Returns the appropriate theme configuration for a given mode.
   * @param mode - The theme mode to get the configuration for
   * @returns The theme configuration for the specified mode or null if not available
   */
  private getThemeForMode(mode: ThemeMode): AnyThemeConfig | null {
    let resolvedMode: ThemeMode = mode;

    if (mode === ThemeMode.SYSTEM) {
      if (this.darkTheme === null) return null;
      resolvedMode = ThemeController.getSystemPreferredMode();
    }

    if (resolvedMode === ThemeMode.DARK) return this.darkTheme;

    return this.defaultTheme;
  }

  /**
   * Determines the initial theme mode with error recovery.
   */
  private determineInitialMode(): ThemeMode {
    // Try to restore saved mode first
    const savedMode: ThemeMode | null = this.loadSavedMode();
    if (savedMode && this.isValidThemeMode(savedMode)) return savedMode;

    // If no dark theme is available, force default mode
    if (this.darkTheme === null) {
      this.storage.removeItem(this.modeStorageKey);
      return ThemeMode.DEFAULT;
    }

    // Use explicit initial mode if provided (e.g. embedded dashboards default to light)
    if (
      this.initialMode !== undefined &&
      this.isValidThemeMode(this.initialMode)
    )
      return this.initialMode;

    // Default to system preference when both themes are available
    return ThemeMode.SYSTEM;
  }

  /**
   * Safely loads saved theme mode from storage.
   */
  private loadSavedMode(): ThemeMode | null {
    try {
      const stored: string | null = this.storage.getItem(this.modeStorageKey);
      if (stored && Object.values(ThemeMode).includes(stored as ThemeMode))
        return stored as ThemeMode;

      return null;
    } catch (error) {
      console.warn('Failed to load saved theme mode:', error);
      return null;
    }
  }

  /**
   * Validates if a theme mode is valid and supported.
   * This checks if the mode is one of the known ThemeMode values.
   * @param mode - The theme mode to validate
   * @returns {boolean} True if the mode is valid, false otherwise
   */
  private isValidThemeMode(mode: ThemeMode): boolean {
    if (!Object.values(ThemeMode).includes(mode)) return false;

    // Validate that we have the required theme data for the mode
    switch (mode) {
      case ThemeMode.DARK:
        // Dark mode is valid if we have a dark theme
        return !!this.darkTheme;
      case ThemeMode.DEFAULT:
        // Default mode is valid if we have a default theme
        return !!this.defaultTheme;
      case ThemeMode.SYSTEM:
        // System mode is valid if dark mode is available
        return !!this.darkTheme;
      default:
        return true;
    }
  }

  /**
   * Validates permission to update theme.
   */
  private validateThemeUpdatePermission(): void {
    if (!this.canSetTheme())
      throw new Error('User does not have permission to update the theme');
  }

  /**
   * Validates permission to update mode.
   * @param newMode - The new mode to validate
   * @throws {Error} If the user does not have permission to update the theme mode
   */
  private validateModeUpdatePermission(newMode: ThemeMode): void {
    // Check if user can set a new theme mode (dark theme must exist)
    if (!this.canSetMode())
      throw new Error(
        'Theme mode changes are not allowed when only one theme is available',
      );
  }

  /**
   * Applies the current theme configuration to the global theme.
   * This method sets the theme on the globalTheme and applies it to the Theme.
   * It also handles any errors that may occur during the application of the theme.
   * @param theme - The theme configuration to apply (may already include base theme tokens)
   */
  private applyTheme(theme: AnyThemeConfig): void {
    try {
      const normalizedConfig = normalizeThemeConfig(theme);

      // Simply apply the theme - it should already be properly merged if needed
      // The merging with base theme happens in getThemeForMode() and other methods
      // that prepare themes before passing them to applyTheme()
      this.globalTheme.setConfig(normalizedConfig);

      // Load custom fonts if specified in theme config
      const fontUrls = (normalizedConfig?.token as Record<string, unknown>)
        ?.fontUrls as string[] | undefined;
      this.loadFonts(fontUrls);
    } catch (error) {
      console.error('Failed to apply theme:', error);
      // Re-throw the error so updateTheme can handle fallback logic
      throw error;
    }
  }

  /**
   * Loads custom fonts from theme configuration.
   * Injects CSS @import statements for font URLs that haven't been loaded yet.
   * @param fontUrls - Array of font URLs to load (e.g., Google Fonts, Adobe Fonts)
   */
  private loadFonts(fontUrls?: string[]): void {
    if (!fontUrls?.length) return;

    // Filter out already loaded fonts
    const newUrls = fontUrls.filter(url => !this.loadedFontUrls.has(url));
    if (newUrls.length === 0) return;

    // Use CSS @import for font loading
    // JSON.stringify provides safe escaping to prevent CSS injection attacks
    const css = newUrls
      .map(url => `@import url(${JSON.stringify(url)});`)
      .join('\n');

    const style = document.createElement('style');
    style.setAttribute('data-superset-fonts', 'true');
    style.textContent = css;
    document.head.appendChild(style);

    // Track loaded fonts to avoid duplicates
    newUrls.forEach(url => this.loadedFontUrls.add(url));
  }

  /**
   * Persists the current theme mode to storage.
   */
  private persistMode(): void {
    try {
      this.storage.setItem(this.modeStorageKey, this.currentMode);
    } catch (error) {
      console.warn('Failed to persist theme mode:', error);
    }
  }

  /**
   * Notifies all registered listeners about global theme changes.
   */
  private notifyListeners(): void {
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(this.globalTheme);
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }

  /**
   * Gets the system's preferred theme mode.
   * @returns {ThemeMode.DARK | ThemeMode.DEFAULT} The system's preferred theme mode
   */
  static getSystemPreferredMode(): ThemeMode.DARK | ThemeMode.DEFAULT {
    try {
      return window.matchMedia(MEDIA_QUERY_DARK_SCHEME).matches
        ? ThemeMode.DARK
        : ThemeMode.DEFAULT;
    } catch (error) {
      console.warn('Failed to detect system theme preference:', error);
      return ThemeMode.DEFAULT;
    }
  }
}
