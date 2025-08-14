# HR_Jiggar Project Improvement Plan

## **Phase 0: Foundational Setup (Quick Wins)**

### **1. Developer Experience** 🔵 LOW EFFORT / HIGH IMPACT

**Status**: Basic ESLint, no formatting or hooks  
**Impact**: Inconsistent code quality, manual formatting  
**Tasks**:

- [ ] Add Prettier for consistent formatting
- [ ] Implement Husky for pre-commit hooks (linting, formatting)
- [ ] Add commit message linting (commitlint)
- [ ] Set up VS Code workspace settings for consistency
- [ ] **New:** Add `.env.local` for environment variables (API keys)

---

## **Phase 1: Critical Fixes & Stability (Week 1-2)** ✅

### **2. API Routes & Error Handling** ✅ HIGH PRIORITY

**Status**: Critical endpoints missing, inconsistent error handling  
**Impact**: App is not functional, poor user experience  
**Effort**: Medium

**Tasks**:

- [ ] Create `src/app/api/genkit/cv-analyzer/route.ts`
- [ ] Create `src/app/api/genkit/jd-analyzer/route.ts`
- [ ] Create `src/app/api/genkit/candidate-summarizer/route.ts`
- [ ] Create `src/app/api/genkit/findSuitablePositions/route.ts`
- [ ] Implement robust error handling and request/response validation in each new route
- [ ] Add React Error Boundaries for major UI sections
- [ ] Implement a global error handler component/toast system for user feedback
- [ ] Ensure all AI calls consistently use the `withRetry` utility

### **3. Data Security & Privacy** ✅ HIGH PRIORITY

**Status**: Sensitive data (CVs) stored in plaintext in localStorage  
**Impact**: Major security vulnerability  
**Effort**: High

**Tasks**:

- [ ] **Investigate and implement a secure client-side storage solution** (e.g., using a library to encrypt data in `localStorage` or moving to `IndexedDB`).
- [ ] Sanitize all file uploads before processing.
- [ ] Add data retention policies and a mechanism for users to clear their data.

### **4. Testing Foundation** ✅ HIGH PRIORITY

**Status**: No tests implemented  
**Impact**: High risk of regressions  
**Effort**: Medium

**Tasks**:

- [ ] Set up Jest and React Testing Library.
- [ ] Add initial unit tests for critical utility functions (`lib/utils.ts`, `lib/retry.ts`).
- [ ] Add basic integration tests for the new API endpoints.

---

## **Phase 2: Code Quality & Maintainability (Week 3-4)** ✅

### **5. Component Architecture** ✅ MEDIUM PRIORITY

**Status**: Large monolithic components (e.g., `page.tsx`)  
**Impact**: Difficult to maintain, test, and understand  
**Effort**: High

**Tasks**:

- [ ] Break down `src/app/page.tsx` into smaller, reusable components:
  - [ ] `DashboardStats`
  - [ ] `FilterPanel`
  - [ ] `TopCandidatesTable`
  - [ ] `RecentAssessmentsTable`
- [ ] Refactor large components in other pages (`/assessment`, `/cv-database`).
  - [ ] `JdUploadSection` (from `src/app/assessment/page.tsx`)
  - [ ] `PastAssessmentsSection` (from `src/app/assessment/page.tsx`)
  - [ ] `AddCandidatesSection` (from `src/app/assessment/page.tsx`)
  - [ ] `ReviewCandidatesSection` (from `src/app/assessment/page.tsx`)
  - [ ] `GenerateSummarySection` (from `src/app/assessment/page.tsx`)
  - [ ] `AddFromDbDialog` (from `src/app/assessment/page.tsx`)
  - [ ] `JobCodeDialog` (from `src/app/assessment/page.tsx`)
  - [ ] `EditScoreDialog` (from `src/app/assessment/page.tsx`)
  - [ ] `EmailPromptDialog` (from `src/app/assessment/page.tsx`)
  - [ ] `AddCandidatesToDbSection` (from `src/app/cv-database/page.tsx`)
  - [ ] `CandidateRecordsTable` (from `src/app/cv-database/page.tsx`)
  - [ ] `CvDetailsSheet` (from `src/app/cv-database/page.tsx`)
  - [ ] `ConflictResolutionDialog` (from `src/app/cv-database/page.tsx`)
  - [ ] `AddCandidatePopover` (from `src/app/cv-database/page.tsx`)
  - [ ] `BulkActions` (from `src/app/cv-database/page.tsx`)

### **6. State Management** ✅ MEDIUM PRIORITY

**Status**: `useContext` works but can be improved for complex state.  
**Impact**: State updates can be hard to trace and debug.  
**Effort**: Medium

**Tasks**:

- [ ] Refactor `client-provider.tsx` to use `useReducer` for more predictable state management.
- [ ] Create custom hooks for specific state slices (e.g., `useHistory`, `useCvDatabase`).
- [ ] Implement optimistic updates for a smoother user experience on data changes.

### **7. Type Safety** 🟡 MEDIUM PRIORITY

**Status**: Good Zod schemas, but runtime validation can be improved.  
**Impact**: Potential for runtime errors from invalid data structures.  
**Effort**: Medium

**Tasks**:

- [ ] Add strict runtime validation for all data parsed from `localStorage`.
- [ ] Enable TypeScript's `strict` mode in `tsconfig.json` and resolve any resulting errors.
- [ ] Eliminate `any` types, replacing them with specific types or `unknown`.

---

## **Phase 3: User Experience & Features (Week 5-6)** 🟡

### **8. Loading States & Skeletons** 🟡 MEDIUM PRIORITY

**Status**: Basic loading indicators, but not comprehensive.  
**Impact**: UI can feel unresponsive during AI operations.  
**Effort**: Medium

**Tasks**:

- [ ] Implement proper loading skeletons for all async operations.
- [ ] Add better empty states with actionable guidance for the user.
- [ ] Show progress indicators for multi-step operations like bulk imports.

### **9. Accessibility (A11y)** 🟡 MEDIUM PRIORITY

**Status**: Basic accessibility, needs significant improvement.  
**Impact**: Excludes users with disabilities.  
**Effort**: Medium

**Tasks**:

- [ ] Add proper ARIA labels and roles to all interactive elements.
- [ ] Ensure full keyboard navigation for all components.
- [ ] Check and fix color contrast to meet WCAG 2.1 AA standards.
- [ ] Implement focus management for modals and dialogs.

### **10. Data Management** 🟡 MEDIUM PRIORITY

**Status**: Basic import/export, no validation.  
**Impact**: Risk of data corruption.  
**Effort**: Medium

**Tasks**:

- [ ] Implement comprehensive data validation before any import operation.
- [ ] Add data migration strategies for handling schema changes over time.
- [ ] Enhance the export feature (e.g., export to CSV).

---

## **Phase 4: Performance & Scalability (Week 7-8)** 🟢

### **11. Performance Optimization** 🟢 LOW PRIORITY

**Status**: No performance optimizations implemented.  
**Impact**: App may slow down with very large datasets.  
**Effort**: High

**Tasks**:

- [ ] Implement `React.memo` for list items like `CandidateCard`.
- [ ] Consider list virtualization (e.g., `react-window`) if lists become very long.
- [ ] Optimize bundle size with dynamic imports for heavy components.

### **12. AI Integration Improvements** 🟢 LOW PRIORITY

**Status**: Basic AI integration.  
**Impact**: UX can be improved for long-running AI tasks.  
**Effort**: High

**Tasks**:

- [ ] Implement streaming responses for AI flows to show results progressively.
- [ ] Add more robust AI response caching to reduce redundant calls and costs.
- [ ] Consider batch processing for analyzing multiple CVs at once.

---

_Last Updated: August 14, 2025_  
_Priority Legend: 🔴 High | 🟡 Medium | 🟢 Low_
