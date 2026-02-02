/**
 * Leo Metals ERP - Company Configuration
 * 
 * This file contains company-specific settings, constants, and configurations
 * for Leo Metals' ERP system.
 */

export const LEO_METALS_CONFIG = {
  // Company Information
  company: {
    name: 'Leo Metals',
    legalName: 'Leo Metals Private Limited',
    tagline: 'Premium Metal Solutions',
    description: 'Leading supplier of quality metal products and alloys',
    industry: 'Metal Manufacturing and Distribution',
    founded: '2020',
  },

  // Metal-Specific Settings
  metalSettings: {
    // Common metal alloy types
    alloyTypes: [
      'Carbon Steel',
      'Stainless Steel',
      'Aluminum',
      'Copper',
      'Brass',
      'Bronze',
      'Galvanized Steel',
      'Mild Steel (MS)',
      'High Carbon Steel',
      'Alloy Steel',
    ],

    // Common metal grades
    steelGrades: [
      'A36', 'A572', 'A588',
      '304', '304L', '316', '316L', '310', '410', '430',
      'MS', 'IS 2062',
      'ASTM A53', 'ASTM A106',
    ],

    // Metal forms/shapes
    metalForms: [
      'Sheet', 'Plate', 'Coil', 'Rod', 'Bar', 'Tube', 'Pipe',
      'Angle', 'Channel', 'Beam', 'Wire', 'Foil', 'Strip',
    ],

    // Surface finishes
    finishes: [
      'Polished', 'Matte', 'Brushed', 'Mill Finish',
      'Galvanized', 'Painted', 'Powder Coated',
      '2B Finish', 'BA Finish', 'No. 4 Finish', 'Mirror Finish',
    ],

    // Standard metal densities (kg/m³)
    metalDensities: {
      'Carbon Steel': 7850,
      'Stainless Steel': 8000,
      'Mild Steel': 7850,
      'Aluminum': 2700,
      'Copper': 8960,
      'Brass': 8500,
      'Bronze': 8800,
    },
  },

  // Feature Flags
  features: {
    enableMetalCertificates: true,
    enableWeightCalculation: true,
    enableScrapManagement: true,
    enableQualityControl: true,
  },
};

export const COMPANY_INFO = LEO_METALS_CONFIG.company;
export const METAL_SETTINGS = LEO_METALS_CONFIG.metalSettings;
export const FEATURES = LEO_METALS_CONFIG.features;

export default LEO_METALS_CONFIG;
