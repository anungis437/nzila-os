const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('services/geofence-privacy-service.ts', [
  [`  ): Promise<{ inside: boolean; distance: number }> {
    const geofence = await db`, `  ): Promise<{ inside: boolean; distance: number; recorded: boolean }> {
    const geofence = await db`],
  [`    // Log entry/exit event if state changed
    if (inside) {
      await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);
    }

    return { inside, distance };`, `    // The point is the caller's own and is only compared; a precise position is stored only for a member who opted in
    // (for the strike permission when the fence belongs to a strike) while tracking is enabled.
    let recorded = false;
    if (inside) {
      const consented = await this.hasValidConsent(userId, fence.strikeId ? "strike" : undefined);
      if (consented && (await this.getConfig()).locationTrackingEnabled) {
        await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);
        recorded = true;
      }
    }

    return { inside, distance, recorded };`],
])
edit('app/api/location/geofence/route.ts', [
  [`      distance: result.distance,
      message:`, `      distance: result.distance,
      recorded: result.recorded,
      message:`],
])
edit('services/__tests__/geofence-privacy-service.test.ts', [
  [`    it('reports inside and logs an entry event', async () => {
      pushSel(
        [{ id: 'g1', unionLocalId: 'org-1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' }],
        [], // logGeofenceEvent insert
      );
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.distance).toBeLessThan(1);
    });`, `    const fence = { id: 'g1', unionLocalId: 'org-1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' };

    it('reports inside and logs an entry event for a member who opted in', async () => {
      pushSel(
        [fence],
        [{ id: 'c1', expiresAt: new Date('2999-01-01') }], // hasValidConsent
        [enabledConfig()], // getConfig
        [], // logGeofenceEvent insert
      );
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.recorded).toBe(true);
      expect(r.distance).toBeLessThan(1);
      expect(h.db.insert).toHaveBeenCalledTimes(1);
    });

    // DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK
    it('reports inside but stores no position for a member who has not opted in', async () => {
      h.db.insert.mockClear();
      pushSel([fence], []); // no consent row
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('stores no position while location tracking is globally disabled', async () => {
      h.db.insert.mockClear();
      pushSel([fence], [{ id: 'c1', expiresAt: new Date('2999-01-01') }], [enabledConfig({ locationTrackingEnabled: false })]);
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('asks for the strike permission when the fence belongs to a strike', async () => {
      h.db.insert.mockClear();
      pushSel([{ ...fence, strikeId: 's1' }], [{ id: 'c1', expiresAt: new Date('2999-01-01'), allowedDuringStrike: false }]);
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });`],
])
console.log('ok')
