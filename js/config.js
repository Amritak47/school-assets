const CFG = {
  DEVICE_TYPES: [
    'Student Laptop','Staff Laptop','Teacher Laptop',
    'Desktop PC','New PC Lab PC','Monitor','iPad','Other'
  ],
  MAKES: ['Dell','Lenovo','Apple','HP','Acer','Samsung','Philips','Microsoft','Other'],
  STATUSES: ['assigned','available','maintenance','retired'],
  CONDITIONS: ['New','Excellent','Good','Fair','Poor'],
  OS_VERSIONS: ['Windows 11','Windows 10','macOS','iOS','iPadOS','Chrome OS','Linux','N/A'],
  FUNDING: ['NT Government','School Budget','Grant Funded','Donated','Unknown'],
  LOCATIONS: [
    'Staff Room','Library','Front Office',"Principal's Office",
    'Business Manager Room','ICT Room','Corner Room',
    'Desert Rose','Student Support','Server Room',
    'Storage','Classroom 1','Classroom 2','Classroom 3',
    'Classroom 4','Classroom 5','Classroom 6','Other'
  ],
  ACCESSORY_TYPES: [
    'HDMI Cable','USB-C Cable','USB-A Cable','DisplayPort Cable',
    'Power Cable','Charging Adapter','USB-C Charger','Lightning Cable',
    'Docking Station','USB Hub','Keyboard','Mouse','Webcam',
    'Headset','Laptop Bag','Tablet Case','Monitor Stand','Other'
  ],
  LICENCE_TYPES: ['Per Device','Per User','Per Mac','Site Licence','Subscription','One-Time'],
  VENDORS: ['Microsoft','Adobe','Apple','Dell','Lenovo','NTG ICT','Other'],
  CHARGER_TYPES: ['USB-C','Lightning','Barrel Connector','MagSafe','Other'],
  STORAGE_OPTIONS: ['32GB','64GB','128GB','256GB','512GB','1TB','N/A'],
  MAINTENANCE_TYPES: ['Repair','Reimage','Hardware Upgrade','Software Install','Inspection','Other'],
  CHECKOUT_STATUS: ['out','returned'],

  KEYS: {
    DEVICES: 'mps_devices',
    ACCESSORIES: 'mps_accessories',
    LICENCES: 'mps_licences',
    VENDORS: 'mps_vendors',
    MAINTENANCE: 'mps_maintenance',
    CHECKOUT: 'mps_checkout',
    AUDIT: 'mps_audit',
    META: 'mps_meta'
  },

  WARRANTY_WARN_DAYS: 90,
  LICENCE_WARN_DAYS: 60,
  DEVICE_AGE_WARN_YEARS: 5,

  SEED_LICENCES: [
    {
      id: 'LIC-001', software: 'Microsoft Windows', vendor: 'Microsoft',
      licenceType: 'Per Device', seats: 143, costPerUnit: 30, totalCost: 4290,
      billingYear: 2026, renewalDate: '2026-12-31', status: 'active',
      assignedTo: 'All Windows Devices',
      notes: 'Based on Windows devices connected to NT Schools network Jan 2026'
    },
    {
      id: 'LIC-002', software: 'Adobe Creative Cloud', vendor: 'Adobe',
      licenceType: 'Per User', seats: 12, costPerUnit: 7, totalCost: 84,
      billingYear: 2026, renewalDate: '2026-12-31', status: 'active',
      assignedTo: 'Staff',
      notes: 'CCE All Apps for K-12 - 80GB. Currently 12 of 12 assigned.'
    },
    {
      id: 'LIC-003', software: 'Apple JAMF', vendor: 'Apple',
      licenceType: 'Per Device', seats: 36, costPerUnit: 13, totalCost: 498,
      billingYear: 2025, renewalDate: '2025-12-31', status: 'active',
      assignedTo: 'All Apple Devices',
      notes: '36 Apple devices @ $13 + 1 Mac @ $30 = $498. Data from 12 Feb 2025.'
    }
  ]
};
