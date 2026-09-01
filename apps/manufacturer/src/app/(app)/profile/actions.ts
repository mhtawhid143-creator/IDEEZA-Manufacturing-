'use server';

import {
  addEquipment,
  removeEquipment,
  saveCapability,
  saveCompany,
  type CompanyEdit,
  type EquipmentEdit,
} from '@/data/profile.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface ProfileState {
  readonly saved: boolean;
  readonly error?: string;
}

/** Saves the company details buyers see and orders ship to. */
export const saveCompanyAction = async (edit: CompanyEdit): Promise<ProfileState> => {
  const actor = await requireManufacturer('/profile');
  try {
    const result = await saveCompany(actor.manufacturerId, edit);
    return result.ok ? { saved: true } : { saved: false, error: result.message };
  } catch (error) {
    if (error instanceof Error) return { saved: false, error: error.message };
    throw error;
  }
};

/** Adds a machine to the floor list buyers read. */
export const addEquipmentAction = async (edit: EquipmentEdit): Promise<ProfileState> => {
  const actor = await requireManufacturer('/profile');
  const result = await addEquipment(actor.manufacturerId, edit);
  return result.ok ? { saved: true } : { saved: false, error: result.message };
};

/** Takes one off it. */
export const removeEquipmentAction = async (equipmentId: string): Promise<ProfileState> => {
  const actor = await requireManufacturer('/profile');
  const result = await removeEquipment(actor.manufacturerId, equipmentId);
  return result.ok ? { saved: true } : { saved: false, error: result.message };
};

export interface CapabilityPayload {
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: string;
  readonly standardLeadTimeDays: string;
}

/** Saves what buyers are matched on: services, regions, minimums, lead time. */
export const saveCapabilityAction = async (
  payload: CapabilityPayload,
): Promise<ProfileState> => {
  const actor = await requireManufacturer('/profile');

  const moq = Number(payload.minimumOrderQuantity.trim());
  const lead = Number(payload.standardLeadTimeDays.trim());
  if (!Number.isFinite(moq) || !Number.isFinite(lead)) {
    return { saved: false, error: 'The minimum quantity and lead time are numbers.' };
  }

  try {
    const result = await saveCapability(actor.manufacturerId, {
      services: payload.services,
      certifications: payload.certifications,
      servedRegions: payload.servedRegions,
      minimumOrderQuantity: Math.round(moq),
      standardLeadTimeDays: Math.round(lead),
    });
    return result.ok ? { saved: true } : { saved: false, error: result.message };
  } catch (error) {
    if (error instanceof Error) return { saved: false, error: error.message };
    throw error;
  }
};
