#!/bin/sh
# glassd test: locks, exit codes, parent death (no feed, dashboard forced hidden, private dirs, test prefixes):
#  (a) two instances with different key prefixes and the same --out: the second exits 75
#  (b) a non-default --key-prefix without --out writes /dev/shm/lgs/<prefix>out.json, not the daemon's file
#  (c) same prefix, different --out: the second exits 75 (overlay keys would collide)
#  (d) parent SIGKILLed: glassd stops by itself; a successor starts
#  (e) --orphan-ok keeps running when the parent dies
G=${GLASSD:-$(cd "$(dirname "$0")/.." && pwd)/glassd}
D=/tmp/lgs-fx
mkdir -p $D
echo "=== (a) same --out, different --key-prefix"
$G --demo --no-feed --dash off --key-prefix glassd-fxA. --out $D/out.json --timeout 5 > $D/a.log 2>&1 &
A=$!
sleep 1
$G --demo --no-feed --dash off --key-prefix glassd-fxB. --out $D/out.json --timeout 3 > $D/b.log 2>&1
echo "second instance exit $? : $(grep -v '^starting' $D/b.log | head -1)"
wait $A; echo "first instance exit $?"
echo "=== (b) default --out for a test prefix"
$G --demo --no-feed --dash off --key-prefix glassd-fxC. --timeout 2 > $D/c.log 2>&1
echo "exit $? ; out file: $(ls /dev/shm/lgs/glassd-fxC.out.json 2>&1) ; daemon out untouched: $(grep -c glassd-fxC /dev/shm/lgs/glassd-out.json 2>/dev/null || echo 0) matches"
rm -f /dev/shm/lgs/glassd-fxC.out.json /dev/shm/lgs/glassd-fxC.out.json.lock /dev/shm/lgs/glassd-fxC.lock
echo "=== (c) same prefix, different --out"
$G --demo --no-feed --dash off --key-prefix glassd-fxD. --out $D/d1.json --timeout 5 > $D/d1.log 2>&1 &
A=$!
sleep 1
$G --demo --no-feed --dash off --key-prefix glassd-fxD. --out $D/d2.json --timeout 3 > $D/d2.log 2>&1
echo "second instance exit $? : $(grep -v '^starting' $D/d2.log | head -1)"
wait $A
echo "=== (d) parent SIGKILLed"
sh -c "$G --demo --no-feed --dash off --key-prefix glassd-fxE. --out $D/e.json > $D/e.log 2>&1 & echo \$! > $D/child.pid; sleep 100" &
P=$!
sleep 3
C=$(cat $D/child.pid)
kill -9 $P
sleep 1
echo "parent killed; glassd $C still alive after 1 s: $(kill -0 $C 2>/dev/null && echo yes || echo no)"
tail -3 $D/e.log
$G --demo --no-feed --dash off --key-prefix glassd-fxE. --out $D/e.json --timeout 2 > $D/e2.log 2>&1
echo "successor exit $?"
echo "=== (e) --orphan-ok"
sh -c "$G --demo --no-feed --dash off --orphan-ok --key-prefix glassd-fxF. --out $D/f.json > $D/f.log 2>&1 & echo \$! > $D/child.pid; sleep 100" &
P=$!
sleep 3
C=$(cat $D/child.pid)
kill -9 $P
sleep 1
echo "parent killed; orphan-ok glassd still alive: $(kill -0 $C 2>/dev/null && echo yes || echo no)"
kill $C; sleep 1; echo "stopped: $(kill -0 $C 2>/dev/null && echo no || echo yes)"
echo "=== locks left in /dev/shm/lgs:"; ls /dev/shm/lgs | grep -i lock
rm -f /dev/shm/lgs/glassd-fx*.lock
rm -rf $D
