export interface Session {
    uuid: string;
    id: string;
    token?: string;
}

export enum Language {
    Fi = 'fi-FI',
    Sv = 'sv-SE',
    En = 'en-GB',
    Da = 'da-DK'
}

export interface Company {
    id: number;
    slug: string;
    name: string;
    logo: string | undefined;
}

export interface Notices {
    // supplierRegisters: [];
    dynamicPurchasingSystems: DynamicPurchasingSystem[];
    notices: Notice[];
    language: Language;
}

export interface DynamicPurchasingSystem {
    id: number;
    customId: string;
    unit: string;
    title: string;
    shortDescription: string;
    additionalDesc: string | undefined;
    isBeingCorrected: boolean;
    deadline: Date | null;
    originalDeadline: string | null;
}

export interface Notice {
    id: number;
    customId: string;
    isBeingCorrected?: boolean;
    published?: Date;
    originalPublished?: string;
    deadline: Date | null;
    originalDeadline: string | null;
    unit: string;
    title: string;
    flags: string[];
    types: string[];
    shortDescription?: string;
    description?: string | null;
    attachments?: NoticeAttachment[];
    links?: string[];
    /* procedure: string; @TODO: do some logic that checks if it's a tender notice and then get these tender-specific fields
    partialTendersAccepted: boolean;
    alternativeTendersAccepted: boolean;
    reservedForWorkCenters: boolean;
    selectionCriteria: string; */
}

export interface NoticeAttachment {
    fileName: string;
    fileUuid: string;
}
