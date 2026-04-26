// Hand-written types for GET /northwind (no JSON schema for this endpoint).
// Mirrors contracts/northwind.json structure.

export type Department = "Engineering" | "Product" | "Sales" | "Marketing" | "Ops";
export type Location = "San Francisco" | "New York" | "Remote";

export interface NorthwindAgent {
  id: string;
  name: string;
  department: Department | string;
  role: string;
  location: Location | string;
  tenure_years: number;
  manager_id: string | null;
  motivators: string[];
  sensitivities: string[];
  baseline_sentiment: number;
  influence_weight: number;
  trust_in_leadership: number;
  is_caregiver: boolean;
  is_influencer: boolean;
}

export interface CollaborationEdge {
  source: string;
  target: string;
  weight: number;
}

export interface Northwind {
  company: string;
  departments: string[];
  locations: string[];
  agents: NorthwindAgent[];
  collaboration_edges: CollaborationEdge[];
}
