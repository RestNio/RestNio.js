const should = require('should');
const PermissionSet = require('../../lib/util/PermissionSet');
describe('PermissionSet', () => {
    let set = new PermissionSet();
    describe('#add()', () => {
        it('should allow strings to be added...', () => {
            set.add('test.dogs.tekkel.kick');
            set.should.containEql('test.dogs.tekkel.kick');
        });
        it('should throw error if something else is added...', () => {
            should.throws(() => {
                set.add({});
            });
        });
    });
    describe('#addAll()', () => {
        it('should add permissions spreaded out...', () => {
            set.add('test.cats.*.cuddle', 'test.dogs.tekkel.cuddle');
            set.should.containEql('test.cats.*.cuddle');
            set.should.containEql('test.dogs.tekkel.kick');
        });
        it('should add permissions specified in array too...', () => {
            set.add(['test.meep', 'test.kees', 'test./^\\w$/.hi']);
            set.should.containEql('test.kees');
            set.should.containEql('test.meep');
            set.should.containEql('test./^\\w$/.hi');
        });
    });
    describe('#has()', () => {
        it('should have access to certain permissions...', () => {
            set.has('test.dogs.tekkel.kick').should.be.true();
            set.has('test.cats.poes.cuddle').should.be.true();
            set.has('test.cats.kat.cuddle').should.be.true();
            set.has('test./^\\w$/.hi').should.be.true();
            set.has('test.h.hi').should.be.true();
        });
        it('should not have access to other permissions...', () => {
            set.has('test.cats.poes.kick').should.be.false();
            set.has('test.hi.hi').should.be.false();
        });
    });
    describe('#intersect()', () => {
        it('keeps perms granted by the cap', () => {
            const cap = new PermissionSet(['pitch.*']);
            const claimed = new PermissionSet(['pitch.motor', 'api.unrelated']);
            const out = cap.intersect(claimed);
            out.has('pitch.motor').should.be.true();
            out.has('api.unrelated').should.be.false();
        });
        it('clamps caller-broader to the cap', () => {
            // Caller claims the broad `pitch.*`; cap only allows the narrow
            // `pitch.set_telem`. Result must clamp down to `pitch.set_telem`,
            // NOT drop the perm — otherwise caller loses access to a route
            // the cap explicitly permits.
            const cap = new PermissionSet(['pitch.set_telem']);
            const claimed = new PermissionSet(['pitch.*']);
            const out = cap.intersect(claimed);
            out.has('pitch.set_telem').should.be.true();
            out.has('pitch.motor').should.be.false();
        });
        it('drops disjoint perms', () => {
            const cap = new PermissionSet(['pitch.*']);
            const claimed = new PermissionSet(['firmware.flash', 'admin.*']);
            const out = cap.intersect(claimed);
            [...out].should.have.length(0);
        });
        it('typical relay shape (api gate + downstream perms)', () => {
            // Caller carries a central-side gate perm (api.wt1) and a
            // downstream-namespace bundle (pitch.*). The link cap is the
            // downstream namespace only. Intersect should drop the gate
            // perm (cap doesn't grant api.*) and keep pitch.* as-is.
            const cap = new PermissionSet(['pitch.*']);
            const claimed = new PermissionSet(['api.wt1', 'pitch.*']);
            const out = cap.intersect(claimed);
            out.has('pitch.motor').should.be.true();
            out.has('pitch.set_telem').should.be.true();
            out.has('api.wt1').should.be.false();
        });
        it('accepts plain iterable as argument', () => {
            const cap = new PermissionSet(['pitch.*']);
            const out = cap.intersect(['pitch.motor', 'admin.flash']);
            out.has('pitch.motor').should.be.true();
            out.has('admin.flash').should.be.false();
        });
    });
});