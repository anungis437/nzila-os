import { describe, it, expect } from 'vitest';
import {
  institutionalModes,
  defaultInstitutionalMode,
  institutionalModeProfiles,
  parseInstitutionalMode,
  getInstitutionalModeProfile,
  withInstitutionalContext,
  rotateNarrativePathway,
} from '../institutional-context';

describe('lib/institutional-context', () => {
  it('exposes the supported modes and a default', () => {
    expect(institutionalModes).toContain('executive');
    expect(defaultInstitutionalMode).toBe('executive');
  });

  describe('parseInstitutionalMode', () => {
    it('returns a recognized mode unchanged', () => {
      expect(parseInstitutionalMode('governance')).toBe('governance');
    });

    it('falls back to the default for unknown or missing input', () => {
      expect(parseInstitutionalMode('bogus')).toBe('executive');
      expect(parseInstitutionalMode(null)).toBe('executive');
      expect(parseInstitutionalMode()).toBe('executive');
    });
  });

  describe('getInstitutionalModeProfile', () => {
    it('returns the profile for a mode', () => {
      expect(getInstitutionalModeProfile('procurement')).toBe(
        institutionalModeProfiles.procurement,
      );
    });
  });

  describe('withInstitutionalContext', () => {
    it('appends a context query param with ?', () => {
      expect(withInstitutionalContext('/solutions', 'executive')).toBe(
        '/solutions?context=executive',
      );
    });

    it('appends with & when a query already exists', () => {
      expect(withInstitutionalContext('/solutions?ref=x', 'governance')).toBe(
        '/solutions?ref=x&context=governance',
      );
    });
  });

  describe('rotateNarrativePathway', () => {
    const pathway = [
      { stage: 'Organizational Problem' },
      { stage: 'Governance Risk' },
      { stage: 'Continuity Impact' },
      { stage: 'Operational Visibility' },
    ];

    it('rotates the pathway to start at the mode entry point', () => {
      // executive entry point is "Continuity Impact" (index 2).
      const rotated = rotateNarrativePathway(pathway, 'executive');
      expect(rotated[0].stage).toBe('Continuity Impact');
      expect(rotated).toHaveLength(4);
      expect(rotated[rotated.length - 1].stage).toBe('Governance Risk');
    });

    it('returns the pathway unchanged when the entry is first or absent', () => {
      // operations entry point is "Organizational Problem" (index 0).
      expect(rotateNarrativePathway(pathway, 'operations')).toBe(pathway);
      // conference entry point not present in this pathway → idx === -1.
      expect(rotateNarrativePathway(pathway, 'conference')).toBe(pathway);
    });
  });
});
