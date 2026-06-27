export type ListingType =
  | "fitness"
  | "pt"
  | "pilates-trainer"
  | "pilates-center";

export interface CategoryMeta {
  type: ListingType;
  label: string;
  short: string;
  description: string;
  /** icon key resolved in components/Icons.tsx */
  icon: "dumbbell" | "trainer" | "pilates" | "studio";
}

export interface Certification {
  name: string;
  issuer: string;
  year: number;
  /** 발급기관 대조를 통해 검증된 자격증 여부 */
  verified: boolean;
}

export interface Review {
  id: string;
  author: string;
  rating: number; // 1.0 - 5.0
  date: string; // YYYY-MM
  text: string;
  tags?: string[];
}

export interface Photo {
  /** 갤러리 캡션 (예: 웨이트 존, 리포머 룸) */
  label: string;
  /** 이미지 분위기를 결정하는 시드 (자체 생성 플레이스홀더 이미지) */
  tone: number;
  /** 업로드된 실제 이미지 URL (있으면 플레이스홀더 대신 사용) */
  url?: string;
}

export type PriceUnit = "session" | "month";

export interface Listing {
  id: string;
  name: string;
  type: ListingType;
  tagline: string;
  district: string; // 자치구 (예: 강남구)
  neighborhood: string; // 동 (예: 역삼동)
  address: string;
  /** 대표 가격 (만원 단위 숫자) */
  priceValue: number;
  priceUnit: PriceUnit;
  /** 화면 표기용 가격 문구 */
  priceLabel: string;
  rating: number; // 평균 평점
  reviewCount: number;
  experienceYears: number;
  gender?: "남" | "여";
  certifications: Certification[];
  specialties: string[];
  amenities: string[];
  photos: Photo[];
  description: string;
  reviews: Review[];
  featured?: boolean;
  /** 공개 상태. pending = 업체 셀프 등록 후 관리자 승인 대기 */
  status?: "published" | "pending";
  /** 셀프 등록 시 연락처(관리자만 확인) */
  submitterContact?: string;
}
