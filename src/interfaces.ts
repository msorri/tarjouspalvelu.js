export interface ISession {
    uuid: string;
    id: string;
    token?: string;
}

export interface ICompany {
    id: number;
    slug: string;
    name: string;
    logo: string | undefined;
}

export interface INotices {
    // supplierRegisters: [];
    dynamicPurchasingSystems: IDynamicPurchasingSystem[];
    notices: INotice[];
    language: 'fi-FI' | 'sv-SE' | 'en-GB' | 'da-DK';
}

export interface IDynamicPurchasingSystem {
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

export interface INotice {
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
    attachments?: INoticeAttachment[];
    links?: string[];
    /* procedure: string; @TODO: do some logic that checks if it's a tender notice and then get these tender-specific fields
    partialTendersAccepted: boolean;
    alternativeTendersAccepted: boolean;
    reservedForWorkCenters: boolean;
    selectionCriteria: string; */
}

export interface INoticeAttachment {
    fileName: string;
    fileUuid: string;
}
