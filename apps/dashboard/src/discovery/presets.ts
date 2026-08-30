export interface DiscoveryPreset {
  id: string;
  name: string;
  category: string;
  defaultQuery: string;
  defaultProvider: string;
  defaultLimit: number;
  enabled: boolean;
}

export const DISCOVERY_PRESETS: DiscoveryPreset[] = [
  {
    id: 'construction',
    name: 'Construction',
    category: 'Industry',
    defaultQuery: 'строительные компании',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'construction_houses',
    name: 'House construction',
    category: 'Industry',
    defaultQuery: 'строительство домов',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'general_contractor',
    name: 'General contractor',
    category: 'Industry',
    defaultQuery: 'генподрядчик',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'renovation',
    name: 'Renovation',
    category: 'Industry',
    defaultQuery: 'ремонт квартир',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'renovation_houses',
    name: 'House renovation',
    category: 'Industry',
    defaultQuery: 'ремонт домов',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'office_renovation',
    name: 'Office renovation',
    category: 'Industry',
    defaultQuery: 'ремонт офисов',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'finishing_works',
    name: 'Finishing works',
    category: 'Industry',
    defaultQuery: 'отделочные работы',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'facade_works',
    name: 'Facade works',
    category: 'Industry',
    defaultQuery: 'фасадные работы',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'electrical',
    name: 'Electrical works',
    category: 'Engineering',
    defaultQuery: 'электромонтаж',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    category: 'Engineering',
    defaultQuery: 'сантехнические работы',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'ventilation',
    name: 'Ventilation',
    category: 'Engineering',
    defaultQuery: 'вентиляция',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'heating',
    name: 'Heating',
    category: 'Engineering',
    defaultQuery: 'отопление',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
  {
    id: 'interior_design',
    name: 'Interior design',
    category: 'Engineering',
    defaultQuery: 'дизайн интерьеров',
    defaultProvider: 'dgis',
    defaultLimit: 50,
    enabled: true,
  },
];

export function getDiscoveryPreset(id: string): DiscoveryPreset | undefined {
  return DISCOVERY_PRESETS.find((p) => p.id === id);
}
