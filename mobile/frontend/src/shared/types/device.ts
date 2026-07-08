/** Device type for dual-site architecture */

export type DeviceType = 'pc' | 'mobile';

/** Device context provided by backend API */
export interface DeviceInfo {
  device_type: DeviceType;
  user_agent: string;
}
