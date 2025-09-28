import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { getGeolocationImplementation } from '../utils/locationSimulator';

export class LocationService {
  private static watchId: string | null = null;

  static async checkPermissions() {
    console.log('[LocationService] Checking permissions...');
    try {
      const result = await Geolocation.checkPermissions();
      console.log('[LocationService] Current permissions:', result);
      return result;
    } catch (error) {
      console.error('[LocationService] Error checking permissions:', error);
      throw error;
    }
  }

  static async requestPermissions() {
    console.log('[LocationService] Requesting permissions...');
    try {
      const result = await Geolocation.requestPermissions();
      console.log('[LocationService] Permission request result:', result);
      return result;
    } catch (error) {
      console.error('[LocationService] Error requesting permissions:', error);
      throw error;
    }
  }

  static async getCurrentPosition(): Promise<Position | null> {
    console.log('[LocationService] Getting current position...');

    if (!Capacitor.isNativePlatform()) {
      console.log('[LocationService] Using web geolocation API');
      return this.getWebPosition();
    }

    try {
      const permissions = await this.checkPermissions();

      if (permissions.location !== 'granted') {
        console.log('[LocationService] Location permission not granted, requesting...');
        const requestResult = await this.requestPermissions();
        if (requestResult.location !== 'granted') {
          console.error('[LocationService] Location permission denied');
          return null;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      console.log('[LocationService] Position obtained:', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });

      return position;
    } catch (error) {
      console.error('[LocationService] Error getting position:', error);
      return null;
    }
  }

  private static async getWebPosition(): Promise<Position | null> {
    return new Promise((resolve) => {
      const geolocation = getGeolocationImplementation();

      if (!geolocation) {
        console.error('[LocationService] Geolocation not supported');
        resolve(null);
        return;
      }

      geolocation.getCurrentPosition(
        (position) => {
          const capacitorPosition: Position = {
            timestamp: position.timestamp,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              heading: position.coords.heading
            }
          };
          console.log('[LocationService] Web position obtained:', capacitorPosition);
          resolve(capacitorPosition);
        },
        (error) => {
          console.error('[LocationService] Web geolocation error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  static async startWatching(callback: (position: Position | null) => void) {
    console.log('[LocationService] Starting location watch...');

    // Check if already watching
    if (this.watchId !== null) {
      console.log('[LocationService] Already watching with ID:', this.watchId, '- stopping previous watch first');
      await this.stopWatching();
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('[LocationService] Using web watch API');
      return this.startWebWatch(callback);
    }

    try {
      const permissions = await this.checkPermissions();
      if (permissions.location !== 'granted') {
        console.error('[LocationService] Location permission not granted for watching');
        return;
      }

      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          maximumAge: 0
        },
        (position, error) => {
          if (error) {
            console.error('[LocationService] Watch error:', error);
            callback(null);
          } else if (position) {
            console.log('[LocationService] Watch position update:', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            callback(position);
          }
        }
      );

      console.log('[LocationService] Watch started with ID:', this.watchId);
    } catch (error) {
      console.error('[LocationService] Error starting watch:', error);
    }
  }

  private static async startWebWatch(callback: (position: Position | null) => void) {
    // Check if already watching - important for web too
    if (this.watchId !== null) {
      console.log('[LocationService] Already watching (web) with ID:', this.watchId, '- stopping previous watch first');
      await this.stopWatching();
    }

    const geolocation = getGeolocationImplementation();

    if (!geolocation) {
      console.error('[LocationService] Geolocation not supported for watching');
      return;
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        const capacitorPosition: Position = {
          timestamp: position.timestamp,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading
          }
        };
        console.log('[LocationService] Web watch position update:', capacitorPosition);
        callback(capacitorPosition);
      },
      (error) => {
        console.error('[LocationService] Web watch error:', error);
        callback(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0
      }
    );

    this.watchId = watchId.toString();
    console.log('[LocationService] Web watch started with ID:', this.watchId);
  }

  static async stopWatching() {
    console.log('[LocationService] Stopping location watch with ID:', this.watchId);

    if (this.watchId) {
      if (!Capacitor.isNativePlatform()) {
        const geolocation = getGeolocationImplementation();
        if (geolocation) {
          const watchIdNum = parseInt(this.watchId);
          console.log('[LocationService] Clearing web watch with numeric ID:', watchIdNum);
          geolocation.clearWatch(watchIdNum);
        }
      } else {
        await Geolocation.clearWatch({ id: this.watchId });
      }
      this.watchId = null;
      console.log('[LocationService] Watch stopped and ID cleared');
    } else {
      console.log('[LocationService] No watch ID to stop');
    }
  }
}