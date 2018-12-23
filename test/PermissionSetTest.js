const should = require('should');
const PermissionSet = require('../lib/util/PermissionSet');
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
            set.addAll('test.cats.*.cuddle', 'test.dogs.tekkel.cuddle');
            set.should.containEql('test.cats.*.cuddle');
            set.should.containEql('test.dogs.tekkel.kick');
        });
        it('should add permissions specified in array too...', () => {
            set.addAll(['test.meep', 'test.kees']);
            set.should.containEql('test.kees');
            set.should.containEql('test.meep');
        });
    });
    describe('#has()', () => {
        it('should have access to certain permissions...', () => {
            set.has('test.dogs.tekkel.kick').should.be.true();
            set.has('test.cats.poes.cuddle').should.be.true();
            set.has('test.cats.kat.cuddle').should.be.true();
        });
        it('should not have access to other permissions...', () => {
            set.has('test.cats.poes.kick').should.be.false();
        });
    });
});