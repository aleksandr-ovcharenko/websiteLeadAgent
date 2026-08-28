import { z } from 'zod';
export declare const designQualitySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const designAvoidSchema: z.ZodObject<{
    label: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    reason?: string | undefined;
}, {
    label: string;
    reason?: string | undefined;
}>;
export declare const designPrioritySchema: z.ZodObject<{
    rank: z.ZodNumber;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    label: string;
    rank: number;
}, {
    label: string;
    rank: number;
}>;
export declare const designBriefSchema: z.ZodObject<{
    client: z.ZodString;
    companyName: z.ZodString;
    website: z.ZodString;
    industry: z.ZodString;
    qualities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description?: string | undefined;
    }, {
        name: string;
        description?: string | undefined;
    }>, "many">;
    visualPriorities: z.ZodArray<z.ZodObject<{
        rank: z.ZodNumber;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        rank: number;
    }, {
        label: string;
        rank: number;
    }>, "many">;
    avoid: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        reason?: string | undefined;
    }, {
        label: string;
        reason?: string | undefined;
    }>, "many">;
    targetAudience: z.ZodOptional<z.ZodString>;
    tone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    client: string;
    companyName: string;
    website: string;
    industry: string;
    qualities: {
        name: string;
        description?: string | undefined;
    }[];
    visualPriorities: {
        label: string;
        rank: number;
    }[];
    avoid: {
        label: string;
        reason?: string | undefined;
    }[];
    targetAudience?: string | undefined;
    tone?: string | undefined;
}, {
    client: string;
    companyName: string;
    website: string;
    industry: string;
    qualities: {
        name: string;
        description?: string | undefined;
    }[];
    visualPriorities: {
        label: string;
        rank: number;
    }[];
    avoid: {
        label: string;
        reason?: string | undefined;
    }[];
    targetAudience?: string | undefined;
    tone?: string | undefined;
}>;
export declare const designTokenSchema: z.ZodObject<{
    colors: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    typography: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    spacing: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    sizes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    radii: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    shadows: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    colors: Record<string, string>;
    typography: Record<string, any>;
    spacing: Record<string, number>;
    sizes: Record<string, any>;
    radii: Record<string, any>;
    shadows: Record<string, string>;
}, {
    colors?: Record<string, string> | undefined;
    typography?: Record<string, any> | undefined;
    spacing?: Record<string, number> | undefined;
    sizes?: Record<string, any> | undefined;
    radii?: Record<string, any> | undefined;
    shadows?: Record<string, string> | undefined;
}>;
export declare const designSystemSchema: z.ZodObject<{
    name: z.ZodString;
    tokens: z.ZodObject<{
        colors: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        typography: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        spacing: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        sizes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        radii: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        shadows: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        colors: Record<string, string>;
        typography: Record<string, any>;
        spacing: Record<string, number>;
        sizes: Record<string, any>;
        radii: Record<string, any>;
        shadows: Record<string, string>;
    }, {
        colors?: Record<string, string> | undefined;
        typography?: Record<string, any> | undefined;
        spacing?: Record<string, number> | undefined;
        sizes?: Record<string, any> | undefined;
        radii?: Record<string, any> | undefined;
        shadows?: Record<string, string> | undefined;
    }>;
    breakpoints: z.ZodObject<{
        mobile: z.ZodDefault<z.ZodNumber>;
        tablet: z.ZodDefault<z.ZodNumber>;
        desktop: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        mobile: number;
        tablet: number;
        desktop: number;
    }, {
        mobile?: number | undefined;
        tablet?: number | undefined;
        desktop?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tokens: {
        colors: Record<string, string>;
        typography: Record<string, any>;
        spacing: Record<string, number>;
        sizes: Record<string, any>;
        radii: Record<string, any>;
        shadows: Record<string, string>;
    };
    breakpoints: {
        mobile: number;
        tablet: number;
        desktop: number;
    };
}, {
    name: string;
    tokens: {
        colors?: Record<string, string> | undefined;
        typography?: Record<string, any> | undefined;
        spacing?: Record<string, number> | undefined;
        sizes?: Record<string, any> | undefined;
        radii?: Record<string, any> | undefined;
        shadows?: Record<string, string> | undefined;
    };
    breakpoints: {
        mobile?: number | undefined;
        tablet?: number | undefined;
        desktop?: number | undefined;
    };
}>;
export type DesignBrief = z.infer<typeof designBriefSchema>;
export type DesignSystem = z.infer<typeof designSystemSchema>;
export { garantkDesignSystem } from './garantkDesignSystem.js';
export declare const garantkBrief: DesignBrief;
