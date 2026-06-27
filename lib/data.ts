import type { CategoryMeta, Listing, ListingType } from "./types";

export const CATEGORIES: CategoryMeta[] = [
  {
    type: "fitness",
    label: "피트니스 센터",
    short: "피트니스",
    description: "헬스장·짐 — 자유롭게 운동하고 GX를 즐길 수 있는 공간",
    icon: "dumbbell",
  },
  {
    type: "pt",
    label: "퍼스널 트레이너",
    short: "PT",
    description: "1:1 맞춤 트레이닝으로 목표까지 함께하는 전문가",
    icon: "trainer",
  },
  {
    type: "pilates-trainer",
    label: "필라테스 트레이너",
    short: "필라테스 강사",
    description: "기구·매트 필라테스 개인 지도 전문 강사",
    icon: "pilates",
  },
  {
    type: "pilates-center",
    label: "필라테스 센터",
    short: "필라테스 센터",
    description: "리포머·캐딜락 등 기구를 갖춘 그룹·개인 레슨 스튜디오",
    icon: "studio",
  },
];

export const CATEGORY_LABEL: Record<ListingType, string> = {
  fitness: "피트니스 센터",
  pt: "퍼스널 트레이너",
  "pilates-trainer": "필라테스 트레이너",
  "pilates-center": "필라테스 센터",
};

export const DISTRICTS = [
  "강남구",
  "서초구",
  "송파구",
  "마포구",
  "용산구",
  "성동구",
  "광진구",
  "영등포구",
  "종로구",
];

export const ALL_SPECIALTIES = [
  "체중감량",
  "근력강화",
  "바디프로필",
  "체형교정",
  "재활운동",
  "산전산후",
  "통증관리",
  "코어강화",
  "벌크업",
  "시니어운동",
  "매트필라테스",
  "기구필라테스",
  "디스크/측만증",
];

export const listings: Listing[] = [
  // ───────────────────────── 피트니스 센터 ─────────────────────────
  {
    id: "ironworks-gangnam",
    name: "아이언웍스 짐 강남",
    type: "fitness",
    tagline: "프리웨이트 특화 24시간 헬스장",
    district: "강남구",
    neighborhood: "역삼동",
    address: "서울 강남구 테헤란로 124길 (역삼동)",
    priceValue: 12,
    priceUnit: "month",
    priceLabel: "월 12만원~",
    rating: 4.6,
    reviewCount: 218,
    experienceYears: 9,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2024, verified: true },
    ],
    specialties: ["근력강화", "벌크업", "바디프로필"],
    amenities: ["24시간 운영", "샤워실", "운동복 대여", "개인 락커", "주차 가능"],
    photos: [
      { label: "프리웨이트 존", tone: 0 },
      { label: "머신 존", tone: 1 },
      { label: "유산소 존", tone: 2 },
      { label: "샤워·락커룸", tone: 3 },
    ],
    description:
      "넓은 프리웨이트 존과 최신 머신을 갖춘 24시간 헬스장입니다. 파워랙 12대, 덤벨 최대 50kg 구비. 회원 누구나 무료 인바디 측정과 첫 방문 시 운동 루틴 가이드를 제공합니다.",
    reviews: [
      { id: "r1", author: "김**", rating: 5, date: "2026-05", text: "기구가 다양하고 사람이 몰려도 대기 없이 운동할 수 있어요. 환기가 잘돼서 쾌적합니다.", tags: ["시설 좋음", "쾌적함"] },
      { id: "r2", author: "이**", rating: 4, date: "2026-04", text: "24시간이라 새벽 운동족에게 최고. 다만 주말 저녁은 다소 붐벼요.", tags: ["24시간"] },
      { id: "r3", author: "박**", rating: 5, date: "2026-03", text: "락커룸과 샤워실이 깨끗하게 관리됩니다. 직원분들도 친절해요.", tags: ["청결"] },
    ],
    featured: true,
  },
  {
    id: "corelab-jamsil",
    name: "코어랩 피트니스",
    type: "fitness",
    tagline: "GX·그룹 운동이 강한 커뮤니티 짐",
    district: "송파구",
    neighborhood: "잠실동",
    address: "서울 송파구 올림픽로 (잠실동)",
    priceValue: 10,
    priceUnit: "month",
    priceLabel: "월 10만원~",
    rating: 4.4,
    reviewCount: 156,
    experienceYears: 6,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2025, verified: true },
    ],
    specialties: ["체중감량", "근력강화", "코어강화"],
    amenities: ["GX룸", "샤워실", "주차 가능", "수건 제공", "그룹 수업"],
    photos: [
      { label: "GX 스튜디오", tone: 4 },
      { label: "웨이트 존", tone: 0 },
      { label: "스피닝 룸", tone: 5 },
    ],
    description:
      "스피닝·바디펌프·요가 등 주 30개 이상의 GX 클래스를 운영하는 커뮤니티 중심 헬스장입니다. 회원권에 모든 그룹 수업이 포함되어 있어 다양한 운동을 시도해볼 수 있습니다.",
    reviews: [
      { id: "r1", author: "정**", rating: 5, date: "2026-05", text: "GX 종류가 정말 많아서 질리지 않아요. 강사님들 텐션이 좋습니다.", tags: ["GX 다양"] },
      { id: "r2", author: "최**", rating: 4, date: "2026-02", text: "그룹 운동 위주로 다니기 좋아요. 웨이트 기구는 살짝 부족한 편.", tags: ["그룹 운동"] },
    ],
  },
  {
    id: "powerhouse-hapjeong",
    name: "파워하우스 짐",
    type: "fitness",
    tagline: "역도·파워리프팅 셋업 완비",
    district: "마포구",
    neighborhood: "합정동",
    address: "서울 마포구 양화로 (합정동)",
    priceValue: 11,
    priceUnit: "month",
    priceLabel: "월 11만원~",
    rating: 4.7,
    reviewCount: 98,
    experienceYears: 5,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2024, verified: true },
    ],
    specialties: ["근력강화", "벌크업"],
    amenities: ["역도 플랫폼", "샤워실", "운동복 대여", "주차 가능"],
    photos: [
      { label: "역도 플랫폼", tone: 1 },
      { label: "파워랙 존", tone: 0 },
      { label: "컨디셔닝 존", tone: 2 },
    ],
    description:
      "역도 플랫폼 6면과 경기용 바벨·범퍼플레이트를 갖춘 스트렝스 전문 헬스장. 파워리프팅 3대 운동에 진심인 분들에게 최적화된 환경을 제공합니다.",
    reviews: [
      { id: "r1", author: "한**", rating: 5, date: "2026-06", text: "역도하기 정말 좋은 환경이에요. 플랫폼과 바벨 퀄리티가 다릅니다.", tags: ["역도 특화"] },
      { id: "r2", author: "오**", rating: 5, date: "2026-04", text: "고중량 운동하는 분들이 많아 분위기가 좋습니다. 초보자 배려도 있어요.", tags: ["분위기"] },
    ],
  },

  // ───────────────────────── 퍼스널 트레이너 ─────────────────────────
  {
    id: "pt-kim-dohyun",
    name: "김도현 트레이너",
    type: "pt",
    tagline: "바디프로필·체중감량 1:1 PT 전문",
    district: "강남구",
    neighborhood: "신사동",
    address: "서울 강남구 도산대로 (신사동) · 제휴 센터 출강",
    priceValue: 8,
    priceUnit: "session",
    priceLabel: "회당 8만원",
    rating: 4.9,
    reviewCount: 142,
    experienceYears: 8,
    gender: "남",
    certifications: [
      { name: "생활스포츠지도사 2급(보디빌딩)", issuer: "문화체육관광부", year: 2017, verified: true },
      { name: "NSCA-CPT", issuer: "NSCA", year: 2019, verified: true },
      { name: "CPR·응급처치", issuer: "대한심폐소생협회", year: 2025, verified: true },
    ],
    specialties: ["바디프로필", "체중감량", "근력강화"],
    amenities: ["1:1 룸", "식단 관리", "운동복 대여"],
    photos: [
      { label: "PT 룸", tone: 6 },
      { label: "트레이닝 현장", tone: 0 },
      { label: "인바디 분석", tone: 7 },
    ],
    description:
      "8년차 퍼스널 트레이너로 누적 회원 400명 이상을 지도했습니다. 무리한 식단 대신 지속 가능한 습관 형성에 초점을 맞춘 8주·12주 바디프로필 프로그램을 운영합니다. 주 1회 식단 피드백 포함.",
    reviews: [
      { id: "r1", author: "윤**", rating: 5, date: "2026-06", text: "12주 만에 -9kg 감량하고 프로필까지 찍었어요. 동작 교정을 정말 꼼꼼히 봐주십니다.", tags: ["감량 성공", "꼼꼼함"] },
      { id: "r2", author: "서**", rating: 5, date: "2026-05", text: "운동 초보였는데 자세부터 차근차근 잡아주셔서 부상 없이 진행했어요.", tags: ["초보 친화"] },
      { id: "r3", author: "강**", rating: 4, date: "2026-03", text: "결과는 확실합니다. 인기가 많아 원하는 시간 예약이 조금 어려운 점만 빼면 만족.", tags: ["효과 좋음"] },
    ],
    featured: true,
  },
  {
    id: "pt-lee-seoyeon",
    name: "이서연 트레이너",
    type: "pt",
    tagline: "여성 체형교정·산전산후 회복",
    district: "서초구",
    neighborhood: "서초동",
    address: "서울 서초구 서초대로 (서초동) · 제휴 센터 출강",
    priceValue: 7,
    priceUnit: "session",
    priceLabel: "회당 7만원",
    rating: 4.8,
    reviewCount: 110,
    experienceYears: 7,
    gender: "여",
    certifications: [
      { name: "생활스포츠지도사 2급", issuer: "문화체육관광부", year: 2018, verified: true },
      { name: "건강운동관리사", issuer: "보건복지부", year: 2020, verified: true },
      { name: "교정운동전문가(NASM-CES)", issuer: "NASM", year: 2021, verified: false },
    ],
    specialties: ["체형교정", "산전산후", "통증관리"],
    amenities: ["1:1 룸", "여성 전용 시간", "식단 관리"],
    photos: [
      { label: "PT 룸", tone: 7 },
      { label: "체형 분석", tone: 4 },
      { label: "스트레칭 존", tone: 5 },
    ],
    description:
      "건강운동관리사 자격을 보유한 여성 전문 트레이너입니다. 출산 후 회복, 거북목·골반 불균형 등 체형교정에 강점이 있으며, 통증 없는 범위에서 점진적으로 강도를 높이는 방식으로 진행합니다.",
    reviews: [
      { id: "r1", author: "김**", rating: 5, date: "2026-06", text: "출산 후 망가진 코어를 되살렸어요. 몸 상태를 세심하게 체크해주셔서 안심됐습니다.", tags: ["산후 회복"] },
      { id: "r2", author: "민**", rating: 5, date: "2026-04", text: "거북목과 라운드숄더가 확실히 개선됐어요. 자세 설명이 이해하기 쉬워요.", tags: ["체형교정"] },
      { id: "r3", author: "조**", rating: 4, date: "2026-02", text: "꼼꼼하고 친절하십니다. 운동 강도를 더 올리고 싶은 분께도 잘 맞춰주세요.", tags: ["친절함"] },
    ],
  },
  {
    id: "pt-park-junyoung",
    name: "박준영 트레이너",
    type: "pt",
    tagline: "근비대·스트렝스 퍼포먼스 코칭",
    district: "성동구",
    neighborhood: "성수동",
    address: "서울 성동구 연무장길 (성수동) · 제휴 센터 출강",
    priceValue: 9,
    priceUnit: "session",
    priceLabel: "회당 9만원",
    rating: 4.7,
    reviewCount: 76,
    experienceYears: 10,
    gender: "남",
    certifications: [
      { name: "생활스포츠지도사 2급(보디빌딩)", issuer: "문화체육관광부", year: 2015, verified: true },
      { name: "NASM-CPT", issuer: "NASM", year: 2018, verified: true },
    ],
    specialties: ["벌크업", "근력강화", "바디프로필"],
    amenities: ["1:1 룸", "운동복 대여", "주차 가능"],
    photos: [
      { label: "스트렝스 존", tone: 0 },
      { label: "PT 현장", tone: 1 },
      { label: "프로그램 상담", tone: 6 },
    ],
    description:
      "10년 경력의 스트렝스 코치로, 정체기에 빠진 중·상급자의 퍼포먼스 향상을 전문으로 합니다. 주기화 프로그램(Periodization) 기반으로 안전하게 고중량을 다루도록 코칭합니다.",
    reviews: [
      { id: "r1", author: "신**", rating: 5, date: "2026-05", text: "정체된 3대 중량을 6개월 만에 60kg 올렸어요. 프로그램 설계가 체계적입니다.", tags: ["퍼포먼스 향상"] },
      { id: "r2", author: "임**", rating: 4, date: "2026-03", text: "디테일한 폼 코칭이 인상적. 무게 욕심내는 저를 잘 잡아주셨어요.", tags: ["폼 교정"] },
    ],
  },
  {
    id: "pt-choi-minji",
    name: "최민지 트레이너",
    type: "pt",
    tagline: "다이어트·생활습관 코칭",
    district: "용산구",
    neighborhood: "이태원동",
    address: "서울 용산구 이태원로 (이태원동) · 제휴 센터 출강",
    priceValue: 6,
    priceUnit: "session",
    priceLabel: "회당 6만원",
    rating: 4.5,
    reviewCount: 64,
    experienceYears: 4,
    gender: "여",
    certifications: [
      { name: "생활스포츠지도사 2급", issuer: "문화체육관광부", year: 2021, verified: true },
      { name: "CPR·응급처치", issuer: "대한심폐소생협회", year: 2024, verified: true },
    ],
    specialties: ["체중감량", "코어강화"],
    amenities: ["1:1 룸", "식단 관리", "온라인 피드백"],
    photos: [
      { label: "PT 룸", tone: 4 },
      { label: "운동 현장", tone: 5 },
    ],
    description:
      "운동을 처음 시작하는 분들의 다이어트와 생활습관 형성에 집중하는 트레이너입니다. 카카오톡 데일리 식단 피드백과 운동 영상 가이드로 센터 밖에서도 꾸준히 이어갈 수 있도록 돕습니다.",
    reviews: [
      { id: "r1", author: "유**", rating: 5, date: "2026-06", text: "운동 1도 모르던 제가 3개월째 꾸준히 다니고 있어요. 부담 없이 동기부여 해주십니다.", tags: ["동기부여"] },
      { id: "r2", author: "권**", rating: 4, date: "2026-04", text: "데일리 식단 피드백이 진짜 도움돼요. 가격도 합리적입니다.", tags: ["가성비"] },
    ],
  },

  // ───────────────────────── 필라테스 트레이너 ─────────────────────────
  {
    id: "pil-han-jiwoo",
    name: "한지우 강사",
    type: "pilates-trainer",
    tagline: "기구 필라테스·체형 밸런스 전문",
    district: "강남구",
    neighborhood: "청담동",
    address: "서울 강남구 압구정로 (청담동) · 제휴 센터 출강",
    priceValue: 9,
    priceUnit: "session",
    priceLabel: "개인 회당 9만원",
    rating: 4.9,
    reviewCount: 132,
    experienceYears: 8,
    gender: "여",
    certifications: [
      { name: "STOTT PILATES 전과정 인증", issuer: "Merrithew", year: 2018, verified: true },
      { name: "재활 필라테스 과정 수료", issuer: "Polestar Pilates", year: 2020, verified: true },
      { name: "생활스포츠지도사 2급(필라테스)", issuer: "문화체육관광부", year: 2019, verified: true },
    ],
    specialties: ["기구필라테스", "체형교정", "코어강화"],
    amenities: ["리포머", "캐딜락", "1:1 룸", "운동복 대여"],
    photos: [
      { label: "리포머 룸", tone: 8 },
      { label: "1:1 레슨", tone: 7 },
      { label: "캐딜락 존", tone: 9 },
    ],
    description:
      "STOTT PILATES 전과정을 이수한 8년차 강사로, 해부학에 기반한 정밀한 큐잉이 강점입니다. 좌우 불균형과 코어 안정성 회복에 특화된 1:1 기구 필라테스를 진행합니다.",
    reviews: [
      { id: "r1", author: "배**", rating: 5, date: "2026-06", text: "몸의 좌우 차이를 정확히 짚어주시고 매 수업 변화가 느껴져요. 큐잉이 명확합니다.", tags: ["전문성", "큐잉 명확"] },
      { id: "r2", author: "송**", rating: 5, date: "2026-05", text: "기구 필라테스 처음인데 자세를 하나하나 교정해주셔서 자세가 달라졌어요.", tags: ["체형교정"] },
      { id: "r3", author: "노**", rating: 5, date: "2026-03", text: "허리 통증 때문에 시작했는데 코어가 잡히면서 통증이 줄었습니다.", tags: ["통증 완화"] },
    ],
    featured: true,
  },
  {
    id: "pil-jung-yujin",
    name: "정유진 강사",
    type: "pilates-trainer",
    tagline: "산전산후·재활 필라테스",
    district: "송파구",
    neighborhood: "방이동",
    address: "서울 송파구 오금로 (방이동) · 제휴 센터 출강",
    priceValue: 8,
    priceUnit: "session",
    priceLabel: "개인 회당 8만원",
    rating: 4.8,
    reviewCount: 89,
    experienceYears: 6,
    gender: "여",
    certifications: [
      { name: "BASI Pilates 지도자 과정", issuer: "BASI Pilates", year: 2020, verified: true },
      { name: "산전산후 필라테스 전문", issuer: "한국필라테스지도자협회", year: 2021, verified: false },
    ],
    specialties: ["산전산후", "재활운동", "매트필라테스"],
    amenities: ["리포머", "1:1 룸", "여성 전용 시간"],
    photos: [
      { label: "리포머 룸", tone: 9 },
      { label: "매트 존", tone: 4 },
      { label: "상담 공간", tone: 7 },
    ],
    description:
      "BASI Pilates 지도자 과정을 수료하고 산전·산후 회복 프로그램을 6년간 운영해온 강사입니다. 임신 주차별 안전 동작과 출산 후 복직근 이개 회복에 중점을 둡니다.",
    reviews: [
      { id: "r1", author: "황**", rating: 5, date: "2026-06", text: "임신 중에도 안전하게 운동할 수 있어 좋았어요. 컨디션을 매번 체크해주십니다.", tags: ["산전 케어"] },
      { id: "r2", author: "안**", rating: 5, date: "2026-04", text: "출산 후 벌어진 복근이 회복됐어요. 전문성이 느껴지는 수업입니다.", tags: ["산후 회복"] },
    ],
  },
  {
    id: "pil-oh-sera",
    name: "오세라 강사",
    type: "pilates-trainer",
    tagline: "매트 필라테스·자세교정 그룹 레슨",
    district: "마포구",
    neighborhood: "연남동",
    address: "서울 마포구 성미산로 (연남동) · 제휴 센터 출강",
    priceValue: 4,
    priceUnit: "session",
    priceLabel: "그룹 회당 4만원",
    rating: 4.6,
    reviewCount: 71,
    experienceYears: 5,
    gender: "여",
    certifications: [
      { name: "매트 필라테스 지도자", issuer: "한국필라테스지도자협회", year: 2021, verified: true },
      { name: "CPR·응급처치", issuer: "대한심폐소생협회", year: 2024, verified: true },
    ],
    specialties: ["매트필라테스", "체형교정", "코어강화"],
    amenities: ["그룹 수업", "운동복 대여", "수건 제공"],
    photos: [
      { label: "매트 그룹 룸", tone: 4 },
      { label: "스트레칭 존", tone: 5 },
    ],
    description:
      "소수정예(최대 6인) 매트 필라테스 그룹 레슨을 운영합니다. 데스크워크로 굳은 어깨·목·허리를 풀어주는 자세교정 시퀀스로 직장인들에게 인기가 많습니다.",
    reviews: [
      { id: "r1", author: "전**", rating: 5, date: "2026-05", text: "퇴근 후 그룹 수업으로 다니기 딱이에요. 인원이 적어서 디테일하게 봐주십니다.", tags: ["소수정예"] },
      { id: "r2", author: "고**", rating: 4, date: "2026-03", text: "가격 대비 만족도가 높아요. 자세교정 효과를 느끼고 있습니다.", tags: ["가성비"] },
    ],
  },
  {
    id: "pil-yoon-gaeun",
    name: "윤가은 강사",
    type: "pilates-trainer",
    tagline: "디스크·측만증 재활 기구 필라테스",
    district: "영등포구",
    neighborhood: "여의도동",
    address: "서울 영등포구 여의대로 (여의도동) · 제휴 센터 출강",
    priceValue: 10,
    priceUnit: "session",
    priceLabel: "개인 회당 10만원",
    rating: 4.9,
    reviewCount: 58,
    experienceYears: 9,
    gender: "여",
    certifications: [
      { name: "Polestar Pilates 재활 과정", issuer: "Polestar Pilates", year: 2017, verified: true },
      { name: "건강운동관리사", issuer: "보건복지부", year: 2019, verified: true },
      { name: "STOTT PILATES 인증", issuer: "Merrithew", year: 2016, verified: true },
    ],
    specialties: ["디스크/측만증", "재활운동", "기구필라테스", "통증관리"],
    amenities: ["리포머", "캐딜락", "1:1 룸"],
    photos: [
      { label: "리포머 룸", tone: 8 },
      { label: "재활 기구 존", tone: 9 },
      { label: "체형 분석", tone: 7 },
    ],
    description:
      "건강운동관리사이자 Polestar 재활 필라테스 과정을 이수한 강사로, 정형외과·도수치료 후 운동 재활을 연결하는 케이스를 다수 진행했습니다. 디스크·척추측만에 대한 1:1 맞춤 접근이 강점입니다.",
    reviews: [
      { id: "r1", author: "류**", rating: 5, date: "2026-06", text: "허리 디스크로 고생했는데 통증이 크게 줄었어요. 의학적 지식이 탄탄하십니다.", tags: ["재활 전문"] },
      { id: "r2", author: "백**", rating: 5, date: "2026-05", text: "측만증 각도 관리에 도움을 많이 받았습니다. 신뢰가 가는 수업이에요.", tags: ["측만 관리"] },
      { id: "r3", author: "남**", rating: 4, date: "2026-02", text: "재활 목적이라면 강력 추천. 가격은 다소 있지만 그만한 값을 합니다.", tags: ["전문성"] },
    ],
  },

  // ───────────────────────── 필라테스 센터 ─────────────────────────
  {
    id: "core-balance-apgujeong",
    name: "코어밸런스 필라테스",
    type: "pilates-center",
    tagline: "리포머·캐딜락 풀세트, 프리미엄 스튜디오",
    district: "강남구",
    neighborhood: "압구정동",
    address: "서울 강남구 압구정로 (압구정동)",
    priceValue: 22,
    priceUnit: "month",
    priceLabel: "월 22만원~ (주2회 그룹)",
    rating: 4.8,
    reviewCount: 204,
    experienceYears: 11,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2025, verified: true },
      { name: "정품 기구 인증(Balanced Body)", issuer: "Balanced Body", year: 2024, verified: true },
    ],
    specialties: ["기구필라테스", "체형교정", "코어강화"],
    amenities: ["리포머 10대", "캐딜락", "체어", "샤워실", "발렛 파킹", "개인 락커"],
    photos: [
      { label: "리포머 메인 홀", tone: 8 },
      { label: "캐딜락 룸", tone: 9 },
      { label: "프라이빗 룸", tone: 7 },
      { label: "라운지", tone: 6 },
    ],
    description:
      "11년 운영된 프리미엄 필라테스 스튜디오로 Balanced Body 정품 기구를 풀세트로 갖추고 있습니다. 전 강사 국제 자격 보유, 최대 4인 그룹과 1:1 개인 레슨을 함께 운영합니다.",
    reviews: [
      { id: "r1", author: "허**", rating: 5, date: "2026-06", text: "기구도 시설도 최상급이에요. 강사진 수준이 균일하게 높습니다.", tags: ["시설 최상", "강사진"] },
      { id: "r2", author: "문**", rating: 5, date: "2026-05", text: "발렛 주차가 되어 편하고, 수업 퀄리티가 일관됩니다.", tags: ["편의성"] },
      { id: "r3", author: "양**", rating: 4, date: "2026-03", text: "가격대는 있지만 그만큼 관리가 잘 됩니다. 예약 시스템도 편해요.", tags: ["관리 우수"] },
    ],
    featured: true,
  },
  {
    id: "flow-pilates-banpo",
    name: "플로우 필라테스 스튜디오",
    type: "pilates-center",
    tagline: "그룹 레슨 중심 합리적 가격",
    district: "서초구",
    neighborhood: "방배동",
    address: "서울 서초구 방배로 (방배동)",
    priceValue: 16,
    priceUnit: "month",
    priceLabel: "월 16만원~ (주2회 그룹)",
    rating: 4.6,
    reviewCount: 138,
    experienceYears: 7,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2024, verified: true },
    ],
    specialties: ["기구필라테스", "매트필라테스", "체중감량"],
    amenities: ["리포머 8대", "타워", "샤워실", "운동복 대여", "주차 가능"],
    photos: [
      { label: "리포머 홀", tone: 9 },
      { label: "매트 룸", tone: 4 },
      { label: "탈의실", tone: 3 },
    ],
    description:
      "합리적인 가격의 그룹 레슨을 중심으로 운영하는 동네 친화형 스튜디오입니다. 최대 5인 소그룹으로 진행하며, 초급·중급·체형교정 등 레벨별 클래스를 분리해 운영합니다.",
    reviews: [
      { id: "r1", author: "구**", rating: 5, date: "2026-06", text: "가격이 착한데 수업 퀄리티가 좋아요. 레벨별로 나뉘어 있어 따라가기 편합니다.", tags: ["가성비", "레벨 분리"] },
      { id: "r2", author: "지**", rating: 4, date: "2026-04", text: "동네에서 편하게 다니기 좋아요. 시간대가 다양합니다.", tags: ["접근성"] },
    ],
  },
  {
    id: "breathe-pilates-jayang",
    name: "브리드 필라테스",
    type: "pilates-center",
    tagline: "호흡·이완 중심 웰니스 스튜디오",
    district: "광진구",
    neighborhood: "자양동",
    address: "서울 광진구 아차산로 (자양동)",
    priceValue: 18,
    priceUnit: "month",
    priceLabel: "월 18만원~ (주2회 그룹)",
    rating: 4.7,
    reviewCount: 92,
    experienceYears: 5,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2025, verified: true },
      { name: "정품 기구 인증(STOTT)", issuer: "Merrithew", year: 2023, verified: false },
    ],
    specialties: ["매트필라테스", "통증관리", "산전산후"],
    amenities: ["리포머 6대", "바렐", "샤워실", "수건 제공", "여성 전용 시간"],
    photos: [
      { label: "리포머 룸", tone: 8 },
      { label: "이완·스트레칭 존", tone: 5 },
      { label: "라운지", tone: 6 },
    ],
    description:
      "호흡과 이완을 강조하는 웰니스 지향 스튜디오입니다. 직장인 스트레스 해소와 통증 완화를 위한 부드러운 시퀀스가 특징이며, 산전산후 전용 클래스도 운영합니다.",
    reviews: [
      { id: "r1", author: "표**", rating: 5, date: "2026-05", text: "수업 후 몸이 가벼워지는 느낌이에요. 분위기가 차분하고 편안합니다.", tags: ["힐링", "분위기"] },
      { id: "r2", author: "추**", rating: 4, date: "2026-03", text: "강도 높은 운동보다 이완 위주라 저에게 잘 맞아요.", tags: ["이완 중심"] },
    ],
  },
  {
    id: "posture-pilates-ikseon",
    name: "포스처 필라테스 랩",
    type: "pilates-center",
    tagline: "자세 분석 기반 체형교정 특화",
    district: "종로구",
    neighborhood: "익선동",
    address: "서울 종로구 돈화문로 (익선동)",
    priceValue: 20,
    priceUnit: "month",
    priceLabel: "월 20만원~ (주2회 그룹)",
    rating: 4.8,
    reviewCount: 67,
    experienceYears: 6,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2024, verified: true },
      { name: "체형분석 시스템 운영 인증", issuer: "한국운동재활협회", year: 2024, verified: true },
    ],
    specialties: ["체형교정", "디스크/측만증", "기구필라테스"],
    amenities: ["체형분석 장비", "리포머 6대", "캐딜락", "개인 락커", "1:1 룸"],
    photos: [
      { label: "체형분석 룸", tone: 7 },
      { label: "리포머 존", tone: 8 },
      { label: "프라이빗 룸", tone: 9 },
    ],
    description:
      "디지털 체형분석으로 첫 수업 전 자세를 측정하고, 데이터를 기반으로 8주 교정 플랜을 설계하는 체형교정 특화 스튜디오입니다. 4주마다 재측정해 변화를 수치로 확인합니다.",
    reviews: [
      { id: "r1", author: "엄**", rating: 5, date: "2026-06", text: "체형 변화가 숫자로 보이니 동기부여가 확실해요. 교정 효과도 좋습니다.", tags: ["데이터 기반", "교정 효과"] },
      { id: "r2", author: "방**", rating: 5, date: "2026-04", text: "골반 틀어짐이 눈에 띄게 좋아졌어요. 분석 리포트가 꼼꼼합니다.", tags: ["분석 우수"] },
    ],
  },
  {
    id: "movement-pilates-seongsu",
    name: "무브먼트 필라테스",
    type: "pilates-center",
    tagline: "성수동 감성, 입문자 친화 스튜디오",
    district: "성동구",
    neighborhood: "성수동",
    address: "서울 성동구 연무장길 (성수동)",
    priceValue: 17,
    priceUnit: "month",
    priceLabel: "월 17만원~ (주2회 그룹)",
    rating: 4.5,
    reviewCount: 84,
    experienceYears: 4,
    certifications: [
      { name: "시설 안전점검 인증", issuer: "한국체육시설업협회", year: 2025, verified: true },
    ],
    specialties: ["기구필라테스", "매트필라테스", "코어강화"],
    amenities: ["리포머 7대", "타워", "샤워실", "운동복 대여", "수건 제공"],
    photos: [
      { label: "리포머 홀", tone: 9 },
      { label: "매트 룸", tone: 4 },
      { label: "포토 스팟", tone: 6 },
    ],
    description:
      "성수동 감성의 인테리어와 입문자 친화적인 커리큘럼으로 처음 필라테스를 시작하는 분들에게 인기 있는 스튜디오입니다. 무료 체험 1회와 입문 4주 패키지를 운영합니다.",
    reviews: [
      { id: "r1", author: "하**", rating: 5, date: "2026-06", text: "인테리어가 예쁘고 강사님이 친절해서 처음인데도 편하게 다녔어요.", tags: ["입문 친화", "분위기"] },
      { id: "r2", author: "성**", rating: 4, date: "2026-03", text: "체험 수업 후 바로 등록했어요. 위치도 좋고 깔끔합니다.", tags: ["접근성"] },
    ],
  },
];

// ───────────────────────── 헬퍼 ─────────────────────────

export function getListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id);
}

export function getByType(type: ListingType): Listing[] {
  return listings.filter((l) => l.type === type);
}

export function getFeatured(limit = 4): Listing[] {
  return listings.filter((l) => l.featured).slice(0, limit);
}

export function getRelated(listing: Listing, limit = 3): Listing[] {
  return listings
    .filter((l) => l.id !== listing.id && l.type === listing.type)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export function categoryMeta(type: ListingType): CategoryMeta {
  return CATEGORIES.find((c) => c.type === type)!;
}

export function verifiedCertCount(listing: Listing): number {
  return listing.certifications.filter((c) => c.verified).length;
}

export function hasVerifiedCert(listing: Listing): boolean {
  return listing.certifications.some((c) => c.verified);
}

/** 통계: 홈 화면 신뢰 지표 */
export function siteStats() {
  const total = listings.length;
  const verified = listings.filter(hasVerifiedCert).length;
  const avgRating =
    listings.reduce((sum, l) => sum + l.rating, 0) / (total || 1);
  const reviews = listings.reduce((sum, l) => sum + l.reviewCount, 0);
  return {
    total,
    verified,
    avgRating: Math.round(avgRating * 10) / 10,
    reviews,
    districts: DISTRICTS.length,
  };
}
