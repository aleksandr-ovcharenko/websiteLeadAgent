import { z } from 'zod';
export declare const blockBaseSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id?: string | undefined;
}, {
    id?: string | undefined;
}>;
export declare const heroBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"hero">;
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    imageId: z.ZodOptional<z.ZodString>;
    buttonLabel: z.ZodOptional<z.ZodString>;
    buttonUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "hero";
    title: string;
    id?: string | undefined;
    subtitle?: string | undefined;
    imageId?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
}, {
    type: "hero";
    title: string;
    id?: string | undefined;
    subtitle?: string | undefined;
    imageId?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
}>;
export declare const textBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"text">;
    heading: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    content: string;
    id?: string | undefined;
    heading?: string | undefined;
}, {
    type: "text";
    content: string;
    id?: string | undefined;
    heading?: string | undefined;
}>;
export declare const imageBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"image">;
    imageId: z.ZodString;
    caption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "image";
    imageId: string;
    id?: string | undefined;
    caption?: string | undefined;
}, {
    type: "image";
    imageId: string;
    id?: string | undefined;
    caption?: string | undefined;
}>;
export declare const galleryBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"gallery">;
    imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "gallery";
    imageIds: string[];
    id?: string | undefined;
}, {
    type: "gallery";
    id?: string | undefined;
    imageIds?: string[] | undefined;
}>;
export declare const servicesBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"services">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "services";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "services";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>;
export declare const projectsBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"projects">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "projects";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "projects";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>;
export declare const newsBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"news">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "news";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "news";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>;
export declare const reviewsBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"reviews">;
    reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        rating: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "reviews";
    reviews: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[];
    id?: string | undefined;
}, {
    type: "reviews";
    id?: string | undefined;
    reviews?: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[] | undefined;
}>;
export declare const ctaBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"cta">;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    buttonLabel: z.ZodOptional<z.ZodString>;
    buttonUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cta";
    title: string;
    id?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
    description?: string | undefined;
}, {
    type: "cta";
    title: string;
    id?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
    description?: string | undefined;
}>;
export declare const contactsBlockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"contacts">;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "contacts";
    id?: string | undefined;
    heading?: string | undefined;
}, {
    type: "contacts";
    id?: string | undefined;
    heading?: string | undefined;
}>;
export declare const contentBlockSchema: z.ZodUnion<[z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"hero">;
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    imageId: z.ZodOptional<z.ZodString>;
    buttonLabel: z.ZodOptional<z.ZodString>;
    buttonUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "hero";
    title: string;
    id?: string | undefined;
    subtitle?: string | undefined;
    imageId?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
}, {
    type: "hero";
    title: string;
    id?: string | undefined;
    subtitle?: string | undefined;
    imageId?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"text">;
    heading: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    content: string;
    id?: string | undefined;
    heading?: string | undefined;
}, {
    type: "text";
    content: string;
    id?: string | undefined;
    heading?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"image">;
    imageId: z.ZodString;
    caption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "image";
    imageId: string;
    id?: string | undefined;
    caption?: string | undefined;
}, {
    type: "image";
    imageId: string;
    id?: string | undefined;
    caption?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"gallery">;
    imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "gallery";
    imageIds: string[];
    id?: string | undefined;
}, {
    type: "gallery";
    id?: string | undefined;
    imageIds?: string[] | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"services">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "services";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "services";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"projects">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "projects";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "projects";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"news">;
    limit: z.ZodOptional<z.ZodNumber>;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "news";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}, {
    type: "news";
    id?: string | undefined;
    heading?: string | undefined;
    limit?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"reviews">;
    reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        rating: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "reviews";
    reviews: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[];
    id?: string | undefined;
}, {
    type: "reviews";
    id?: string | undefined;
    reviews?: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[] | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"cta">;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    buttonLabel: z.ZodOptional<z.ZodString>;
    buttonUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cta";
    title: string;
    id?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
    description?: string | undefined;
}, {
    type: "cta";
    title: string;
    id?: string | undefined;
    buttonLabel?: string | undefined;
    buttonUrl?: string | undefined;
    description?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
} & {
    type: z.ZodLiteral<"contacts">;
    heading: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "contacts";
    id?: string | undefined;
    heading?: string | undefined;
}, {
    type: "contacts";
    id?: string | undefined;
    heading?: string | undefined;
}>]>;
export declare const contentMediaSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    filename: z.ZodString;
    originalFilename: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
    alt: z.ZodOptional<z.ZodString>;
    caption: z.ZodOptional<z.ZodString>;
    dataBase64: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    id?: string | undefined;
    caption?: string | undefined;
    sourceUrl?: string | undefined;
    originalFilename?: string | undefined;
    mimeType?: string | undefined;
    alt?: string | undefined;
    dataBase64?: string | undefined;
}, {
    filename: string;
    id?: string | undefined;
    caption?: string | undefined;
    sourceUrl?: string | undefined;
    originalFilename?: string | undefined;
    mimeType?: string | undefined;
    alt?: string | undefined;
    dataBase64?: string | undefined;
}>;
export declare const contentPageSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodString;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
    isHomepage: z.ZodDefault<z.ZodBoolean>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"hero">;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        imageId: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"text">;
        heading: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"image">;
        imageId: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"gallery">;
        imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    }, {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"services">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"projects">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"news">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"reviews">;
        reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
            author: z.ZodOptional<z.ZodString>;
            text: z.ZodString;
            rating: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    }, {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"cta">;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"contacts">;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }>]>, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    slug: string;
    sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
    isHomepage: boolean;
    blocks: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[];
    sourceUrl?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
}, {
    title: string;
    slug: string;
    sourceUrl?: string | undefined;
    sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
    isHomepage?: boolean | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    blocks?: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[] | undefined;
}>;
export declare const contentServiceSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodString;
    shortDescription: z.ZodOptional<z.ZodString>;
    blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"hero">;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        imageId: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"text">;
        heading: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"image">;
        imageId: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"gallery">;
        imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    }, {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"services">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"projects">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"news">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"reviews">;
        reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
            author: z.ZodOptional<z.ZodString>;
            text: z.ZodString;
            rating: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    }, {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"cta">;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"contacts">;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }>]>, "many">>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        filename: z.ZodString;
        originalFilename: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        dataBase64: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    slug: string;
    sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
    blocks: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[];
    image?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
    sourceUrl?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    shortDescription?: string | undefined;
}, {
    title: string;
    slug: string;
    image?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
    sourceUrl?: string | undefined;
    sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    blocks?: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[] | undefined;
    shortDescription?: string | undefined;
}>;
export declare const contentProjectSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodString;
    excerpt: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    completionDate: z.ZodOptional<z.ZodString>;
    blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"hero">;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        imageId: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"text">;
        heading: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"image">;
        imageId: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"gallery">;
        imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    }, {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"services">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"projects">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"news">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"reviews">;
        reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
            author: z.ZodOptional<z.ZodString>;
            text: z.ZodString;
            rating: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    }, {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"cta">;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"contacts">;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }>]>, "many">>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    coverImage: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        filename: z.ZodString;
        originalFilename: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        dataBase64: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }>>;
    gallery: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        filename: z.ZodString;
        originalFilename: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        dataBase64: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    gallery: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }[];
    slug: string;
    sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
    blocks: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[];
    sourceUrl?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    excerpt?: string | undefined;
    category?: string | undefined;
    location?: string | undefined;
    completionDate?: string | undefined;
    coverImage?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
}, {
    title: string;
    slug: string;
    gallery?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }[] | undefined;
    sourceUrl?: string | undefined;
    sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    blocks?: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[] | undefined;
    excerpt?: string | undefined;
    category?: string | undefined;
    location?: string | undefined;
    completionDate?: string | undefined;
    coverImage?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
}>;
export declare const contentNewsSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodString;
    excerpt: z.ZodOptional<z.ZodString>;
    publishedAt: z.ZodOptional<z.ZodString>;
    blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"hero">;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        imageId: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }, {
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"text">;
        heading: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"image">;
        imageId: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }, {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"gallery">;
        imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    }, {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"services">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"projects">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"news">;
        limit: z.ZodOptional<z.ZodNumber>;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }, {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"reviews">;
        reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
            author: z.ZodOptional<z.ZodString>;
            text: z.ZodString;
            rating: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }, {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    }, {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"cta">;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        buttonLabel: z.ZodOptional<z.ZodString>;
        buttonUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }, {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
    } & {
        type: z.ZodLiteral<"contacts">;
        heading: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }, {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    }>]>, "many">>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    coverImage: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        filename: z.ZodString;
        originalFilename: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        dataBase64: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    slug: string;
    sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
    blocks: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        imageIds: string[];
        id?: string | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        reviews: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[];
        id?: string | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[];
    sourceUrl?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    excerpt?: string | undefined;
    coverImage?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
    publishedAt?: string | undefined;
}, {
    title: string;
    slug: string;
    sourceUrl?: string | undefined;
    sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    blocks?: ({
        type: "hero";
        title: string;
        id?: string | undefined;
        subtitle?: string | undefined;
        imageId?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
    } | {
        type: "text";
        content: string;
        id?: string | undefined;
        heading?: string | undefined;
    } | {
        type: "image";
        imageId: string;
        id?: string | undefined;
        caption?: string | undefined;
    } | {
        type: "gallery";
        id?: string | undefined;
        imageIds?: string[] | undefined;
    } | {
        type: "services";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "projects";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "news";
        id?: string | undefined;
        heading?: string | undefined;
        limit?: number | undefined;
    } | {
        type: "reviews";
        id?: string | undefined;
        reviews?: {
            text: string;
            author?: string | undefined;
            rating?: number | undefined;
        }[] | undefined;
    } | {
        type: "cta";
        title: string;
        id?: string | undefined;
        buttonLabel?: string | undefined;
        buttonUrl?: string | undefined;
        description?: string | undefined;
    } | {
        type: "contacts";
        id?: string | undefined;
        heading?: string | undefined;
    })[] | undefined;
    excerpt?: string | undefined;
    coverImage?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    } | undefined;
    publishedAt?: string | undefined;
}>;
export interface ContentNavigationItem {
    label: string;
    url?: string;
    children?: ContentNavigationItem[];
}
export declare const contentNavigationItemSchema: z.ZodType<ContentNavigationItem>;
export declare const contentContactsSchema: z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    workingHours: z.ZodOptional<z.ZodString>;
    socialLinks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        platform: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        platform: string;
    }, {
        url: string;
        platform: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    socialLinks: {
        url: string;
        platform: string;
    }[];
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    workingHours?: string | undefined;
}, {
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    workingHours?: string | undefined;
    socialLinks?: {
        url: string;
        platform: string;
    }[] | undefined;
}>;
export declare const contentBrandingSchema: z.ZodObject<{
    companyName: z.ZodOptional<z.ZodString>;
    primaryColor: z.ZodOptional<z.ZodString>;
    secondaryColor: z.ZodOptional<z.ZodString>;
    defaultSeoTitle: z.ZodOptional<z.ZodString>;
    defaultSeoDescription: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    companyName?: string | undefined;
    primaryColor?: string | undefined;
    secondaryColor?: string | undefined;
    defaultSeoTitle?: string | undefined;
    defaultSeoDescription?: string | undefined;
}, {
    companyName?: string | undefined;
    primaryColor?: string | undefined;
    secondaryColor?: string | undefined;
    defaultSeoTitle?: string | undefined;
    defaultSeoDescription?: string | undefined;
}>;
export declare const extractedContentSchema: z.ZodObject<{
    company: z.ZodDefault<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        workingHours: z.ZodOptional<z.ZodString>;
        socialLinks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            platform: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            platform: string;
        }, {
            url: string;
            platform: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        socialLinks: {
            url: string;
            platform: string;
        }[];
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        name?: string | undefined;
    }, {
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        socialLinks?: {
            url: string;
            platform: string;
        }[] | undefined;
        name?: string | undefined;
    }>>;
    branding: z.ZodDefault<z.ZodObject<{
        companyName: z.ZodOptional<z.ZodString>;
        primaryColor: z.ZodOptional<z.ZodString>;
        secondaryColor: z.ZodOptional<z.ZodString>;
        defaultSeoTitle: z.ZodOptional<z.ZodString>;
        defaultSeoDescription: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        companyName?: string | undefined;
        primaryColor?: string | undefined;
        secondaryColor?: string | undefined;
        defaultSeoTitle?: string | undefined;
        defaultSeoDescription?: string | undefined;
    }, {
        companyName?: string | undefined;
        primaryColor?: string | undefined;
        secondaryColor?: string | undefined;
        defaultSeoTitle?: string | undefined;
        defaultSeoDescription?: string | undefined;
    }>>;
    navigation: z.ZodDefault<z.ZodArray<z.ZodType<ContentNavigationItem, z.ZodTypeDef, ContentNavigationItem>, "many">>;
    pages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        slug: z.ZodString;
        sourceUrl: z.ZodOptional<z.ZodString>;
        sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
        isHomepage: z.ZodDefault<z.ZodBoolean>;
        seoTitle: z.ZodOptional<z.ZodString>;
        seoDescription: z.ZodOptional<z.ZodString>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"hero">;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            imageId: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"text">;
            heading: z.ZodOptional<z.ZodString>;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"image">;
            imageId: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"gallery">;
            imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        }, {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"services">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"projects">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"news">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"reviews">;
            reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
                author: z.ZodOptional<z.ZodString>;
                text: z.ZodString;
                rating: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"cta">;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"contacts">;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }>]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        isHomepage: boolean;
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
    }, {
        title: string;
        slug: string;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        isHomepage?: boolean | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
    }>, "many">>;
    services: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        slug: z.ZodString;
        shortDescription: z.ZodOptional<z.ZodString>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"hero">;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            imageId: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"text">;
            heading: z.ZodOptional<z.ZodString>;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"image">;
            imageId: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"gallery">;
            imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        }, {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"services">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"projects">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"news">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"reviews">;
            reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
                author: z.ZodOptional<z.ZodString>;
                text: z.ZodString;
                rating: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"cta">;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"contacts">;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }>]>, "many">>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
        seoTitle: z.ZodOptional<z.ZodString>;
        seoDescription: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            filename: z.ZodString;
            originalFilename: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
            alt: z.ZodOptional<z.ZodString>;
            caption: z.ZodOptional<z.ZodString>;
            dataBase64: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        image?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        shortDescription?: string | undefined;
    }, {
        title: string;
        slug: string;
        image?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        shortDescription?: string | undefined;
    }>, "many">>;
    projects: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        slug: z.ZodString;
        excerpt: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        completionDate: z.ZodOptional<z.ZodString>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"hero">;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            imageId: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"text">;
            heading: z.ZodOptional<z.ZodString>;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"image">;
            imageId: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"gallery">;
            imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        }, {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"services">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"projects">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"news">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"reviews">;
            reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
                author: z.ZodOptional<z.ZodString>;
                text: z.ZodString;
                rating: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"cta">;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"contacts">;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }>]>, "many">>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
        seoTitle: z.ZodOptional<z.ZodString>;
        seoDescription: z.ZodOptional<z.ZodString>;
        coverImage: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            filename: z.ZodString;
            originalFilename: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
            alt: z.ZodOptional<z.ZodString>;
            caption: z.ZodOptional<z.ZodString>;
            dataBase64: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }>>;
        gallery: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            filename: z.ZodString;
            originalFilename: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
            alt: z.ZodOptional<z.ZodString>;
            caption: z.ZodOptional<z.ZodString>;
            dataBase64: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        gallery: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }[];
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        excerpt?: string | undefined;
        category?: string | undefined;
        location?: string | undefined;
        completionDate?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
    }, {
        title: string;
        slug: string;
        gallery?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }[] | undefined;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        excerpt?: string | undefined;
        category?: string | undefined;
        location?: string | undefined;
        completionDate?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
    }>, "many">>;
    news: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        slug: z.ZodString;
        excerpt: z.ZodOptional<z.ZodString>;
        publishedAt: z.ZodOptional<z.ZodString>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"hero">;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            imageId: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }, {
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"text">;
            heading: z.ZodOptional<z.ZodString>;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"image">;
            imageId: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"gallery">;
            imageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        }, {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"services">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"projects">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"news">;
            limit: z.ZodOptional<z.ZodNumber>;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }, {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"reviews">;
            reviews: z.ZodDefault<z.ZodArray<z.ZodObject<{
                author: z.ZodOptional<z.ZodString>;
                text: z.ZodString;
                rating: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }, {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"cta">;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            buttonLabel: z.ZodOptional<z.ZodString>;
            buttonUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }, {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
        } & {
            type: z.ZodLiteral<"contacts">;
            heading: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }, {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        }>]>, "many">>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        sourceType: z.ZodDefault<z.ZodEnum<["IMPORTED", "MANUAL", "AI_REWRITTEN"]>>;
        seoTitle: z.ZodOptional<z.ZodString>;
        seoDescription: z.ZodOptional<z.ZodString>;
        coverImage: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            filename: z.ZodString;
            originalFilename: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
            alt: z.ZodOptional<z.ZodString>;
            caption: z.ZodOptional<z.ZodString>;
            dataBase64: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }, {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        excerpt?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        publishedAt?: string | undefined;
    }, {
        title: string;
        slug: string;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        excerpt?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        publishedAt?: string | undefined;
    }>, "many">>;
    reviews: z.ZodDefault<z.ZodDefault<z.ZodArray<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        rating: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }, {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }>, "many">>>;
    contacts: z.ZodDefault<z.ZodObject<{
        phone: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        workingHours: z.ZodOptional<z.ZodString>;
        socialLinks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            platform: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            platform: string;
        }, {
            url: string;
            platform: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        socialLinks: {
            url: string;
            platform: string;
        }[];
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
    }, {
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        socialLinks?: {
            url: string;
            platform: string;
        }[] | undefined;
    }>>;
    media: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        filename: z.ZodString;
        originalFilename: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        dataBase64: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }, {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    services: {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        image?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        shortDescription?: string | undefined;
    }[];
    projects: {
        title: string;
        gallery: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }[];
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        excerpt?: string | undefined;
        category?: string | undefined;
        location?: string | undefined;
        completionDate?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
    }[];
    news: {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        excerpt?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        publishedAt?: string | undefined;
    }[];
    reviews: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[];
    contacts: {
        socialLinks: {
            url: string;
            platform: string;
        }[];
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
    };
    company: {
        socialLinks: {
            url: string;
            platform: string;
        }[];
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        name?: string | undefined;
    };
    branding: {
        companyName?: string | undefined;
        primaryColor?: string | undefined;
        secondaryColor?: string | undefined;
        defaultSeoTitle?: string | undefined;
        defaultSeoDescription?: string | undefined;
    };
    navigation: ContentNavigationItem[];
    pages: {
        title: string;
        slug: string;
        sourceType: "IMPORTED" | "MANUAL" | "AI_REWRITTEN";
        isHomepage: boolean;
        blocks: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            imageIds: string[];
            id?: string | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            reviews: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[];
            id?: string | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[];
        sourceUrl?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
    }[];
    media: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }[];
}, {
    services?: {
        title: string;
        slug: string;
        image?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        shortDescription?: string | undefined;
    }[] | undefined;
    projects?: {
        title: string;
        slug: string;
        gallery?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        }[] | undefined;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        excerpt?: string | undefined;
        category?: string | undefined;
        location?: string | undefined;
        completionDate?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
    }[] | undefined;
    news?: {
        title: string;
        slug: string;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
        excerpt?: string | undefined;
        coverImage?: {
            filename: string;
            id?: string | undefined;
            caption?: string | undefined;
            sourceUrl?: string | undefined;
            originalFilename?: string | undefined;
            mimeType?: string | undefined;
            alt?: string | undefined;
            dataBase64?: string | undefined;
        } | undefined;
        publishedAt?: string | undefined;
    }[] | undefined;
    reviews?: {
        text: string;
        author?: string | undefined;
        rating?: number | undefined;
    }[] | undefined;
    contacts?: {
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        socialLinks?: {
            url: string;
            platform: string;
        }[] | undefined;
    } | undefined;
    company?: {
        phone?: string | undefined;
        email?: string | undefined;
        address?: string | undefined;
        workingHours?: string | undefined;
        socialLinks?: {
            url: string;
            platform: string;
        }[] | undefined;
        name?: string | undefined;
    } | undefined;
    branding?: {
        companyName?: string | undefined;
        primaryColor?: string | undefined;
        secondaryColor?: string | undefined;
        defaultSeoTitle?: string | undefined;
        defaultSeoDescription?: string | undefined;
    } | undefined;
    navigation?: ContentNavigationItem[] | undefined;
    pages?: {
        title: string;
        slug: string;
        sourceUrl?: string | undefined;
        sourceType?: "IMPORTED" | "MANUAL" | "AI_REWRITTEN" | undefined;
        isHomepage?: boolean | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        blocks?: ({
            type: "hero";
            title: string;
            id?: string | undefined;
            subtitle?: string | undefined;
            imageId?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
        } | {
            type: "text";
            content: string;
            id?: string | undefined;
            heading?: string | undefined;
        } | {
            type: "image";
            imageId: string;
            id?: string | undefined;
            caption?: string | undefined;
        } | {
            type: "gallery";
            id?: string | undefined;
            imageIds?: string[] | undefined;
        } | {
            type: "services";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "projects";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "news";
            id?: string | undefined;
            heading?: string | undefined;
            limit?: number | undefined;
        } | {
            type: "reviews";
            id?: string | undefined;
            reviews?: {
                text: string;
                author?: string | undefined;
                rating?: number | undefined;
            }[] | undefined;
        } | {
            type: "cta";
            title: string;
            id?: string | undefined;
            buttonLabel?: string | undefined;
            buttonUrl?: string | undefined;
            description?: string | undefined;
        } | {
            type: "contacts";
            id?: string | undefined;
            heading?: string | undefined;
        })[] | undefined;
    }[] | undefined;
    media?: {
        filename: string;
        id?: string | undefined;
        caption?: string | undefined;
        sourceUrl?: string | undefined;
        originalFilename?: string | undefined;
        mimeType?: string | undefined;
        alt?: string | undefined;
        dataBase64?: string | undefined;
    }[] | undefined;
}>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ExtractedContent = z.infer<typeof extractedContentSchema>;
