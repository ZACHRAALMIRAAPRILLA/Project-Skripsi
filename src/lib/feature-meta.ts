import type { GLCMFeatures } from "./types";

export interface FeatureMeta {
  key: keyof GLCMFeatures;
  label: string; // Indonesian
  englishLabel: string;
  short: string; // one-liner
  description: string; // longer explanation
}

export const FEATURE_META: FeatureMeta[] = [
  {
    key: "contrast",
    label: "e",
    englishLabel: "Contrast",
    short: "Mengukur variasi intensitas antar piksel.",
    description:
      "Kontras menggambarkan seberapa besar perbedaan tingkat keabuan antar piksel yang berdekatan. Nilai tinggi menunjukkan tekstur yang kasar dan banyak detail tajam — sering muncul karena noise atau goresan pada foto lama.",
  },
  {
    key: "correlation",
    label: "Korelasi",
    englishLabel: "Correlation",
    short: "Menunjukkan keteraturan pola tekstur.",
    description:
      "Korelasi mengukur hubungan linier antar piksel yang bertetangga. Nilainya berkisar dari -1 hingga 1; semakin mendekati 1 berarti pola tekstur foto semakin teratur dan konsisten.",
  },
  {
    key: "energy",
    label: "Energi",
    englishLabel: "Energy",
    short: "Mengukur keseragaman tekstur.",
    description:
      "Energi (uniformity) mengindikasikan seberapa seragam distribusi nilai tekstur. Nilai tinggi berarti permukaan halus dan dominan oleh pola serupa, sedangkan nilai rendah menandakan tekstur kompleks atau rusak.",
  },
  {
    key: "homogeneity",
    label: "Homogenitas",
    englishLabel: "Homogeneity",
    short: "Mengukur kemiripan piksel bertetangga.",
    description:
      "Homogenitas menggambarkan seberapa dekat distribusi GLCM terhadap diagonalnya. Nilai tinggi berarti banyak pasangan piksel dengan nilai keabuan serupa — menandakan tekstur halus dan minim degradasi.",
  },
];
