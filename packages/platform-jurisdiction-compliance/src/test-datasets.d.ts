/**
 * @nzila/platform-jurisdiction-compliance — Test Dataset Generators
 *
 * Generates realistic test data for each jurisdiction, useful for load tests
 * and development environments.
 *
 * @module @nzila/platform-jurisdiction-compliance/test-datasets
 */
export interface TestCooperative {
    id: string;
    name: string;
    jurisdiction: string;
    memberCount: number;
    registrationNumber: string;
    taxId: string;
    createdAt: string;
}
export interface TestFarmer {
    id: string;
    memberId: string;
    coopId: string;
    name: string;
    phone: string;
    jurisdiction: string;
    preferredCrops: readonly string[];
    joinedAt: string;
}
export interface TestExaminee {
    id: string;
    jurisdiction: string;
    name: string;
    examType: string;
    attempts: number;
    lastAttempt?: string;
    grade?: number;
    certificateExpiry?: string;
}
export declare function generateKenyaCooperative(): TestCooperative;
export declare function generateKenyaFarmers(coopId: string, count: number): TestFarmer[];
export declare function generateKenyaExaminee(): TestExaminee;
export declare function generateUgandaCooperative(): TestCooperative;
export declare function generateUgandaFarmers(coopId: string, count: number): TestFarmer[];
export declare function generateUgandaExaminee(): TestExaminee;
export declare function generateNigeriaCooperative(): TestCooperative;
export declare function generateNigeriaFarmers(coopId: string, count: number): TestFarmer[];
export declare function generateNigeriaExaminee(): TestExaminee;
export declare function generateTestDataset(jurisdiction: string, scale: 'small' | 'medium' | 'large'): {
    coops: TestCooperative[];
    farmers: TestFarmer[];
    examinees: TestExaminee[];
    count: {
        coops: number;
        farmers: number;
        examinees: number;
    };
};
//# sourceMappingURL=test-datasets.d.ts.map