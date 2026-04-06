import mqtt, { MqttClient } from 'mqtt';
import { config } from '../config';
import { db } from '../db';
import { doors } from '../db/schema';
import { eq } from 'drizzle-orm';

let client: MqttClient | null = null;

export function initMqtt(): MqttClient | null {
  if (!process.env.MQTT_HOST) {
    console.warn('⚠️ MQTT not configured — skipping');
    return null;
  }
  const url = `mqtt://${config.mqtt.host}:${config.mqtt.port}`;
  client = mqtt.connect(url);

  client.on('connect', () => {
    console.log('🔌 MQTT connected');
    client!.subscribe('keypass/+/doors/+/status', (err) => {
      if (err) console.error('MQTT subscribe error:', err);
    });
    client!.subscribe('keypass/+/doors/+/heartbeat', (err) => {
      if (err) console.error('MQTT subscribe error:', err);
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/');
      const doorId = parts[3];
      const type = parts[4];
      const payload = JSON.parse(message.toString());

      if (type === 'status') {
        await db.update(doors)
          .set({
            isOnline: payload.online,
            lastSeenAt: new Date(),
            firmwareVersion: payload.firmware || undefined,
          })
          .where(eq(doors.id, doorId));
      } else if (type === 'heartbeat') {
        await db.update(doors)
          .set({ lastSeenAt: new Date(), isOnline: true })
          .where(eq(doors.id, doorId));
      }
    } catch (err) {
      console.error('MQTT message processing error:', err);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });

  return client;
}

export function publishUnlock(orgId: string, doorId: string): void {
  if (!client) return;
  const topic = `keypass/${orgId}/doors/${doorId}/command`;
  client.publish(topic, JSON.stringify({ action: 'unlock' }));
}

export function publishSync(orgId: string, doorId: string, credentials: any[]): void {
  if (!client) return;
  const topic = `keypass/${orgId}/doors/${doorId}/sync`;
  client.publish(topic, JSON.stringify({ credentials }));
}

// Mock function for simulating device events (dev mode)
export function simulateDeviceEvent(orgId: string, doorId: string, event: string): void {
  console.log(`🔧 [MOCK MQTT] Simulating ${event} for door ${doorId} in org ${orgId}`);
  if (event === 'online') {
    db.update(doors)
      .set({ isOnline: true, lastSeenAt: new Date() })
      .where(eq(doors.id, doorId))
      .then(() => {});
  } else if (event === 'offline') {
    db.update(doors)
      .set({ isOnline: false })
      .where(eq(doors.id, doorId))
      .then(() => {});
  }
}

export function getMqttClient(): MqttClient | null {
  return client;
}
