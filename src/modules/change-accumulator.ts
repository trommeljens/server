import { Subject } from "rxjs";
import { firestore } from "firebase-admin";
import { scan } from "rxjs/operators";

export interface ChangeAccumulatorEvent {
    /**
     * Reason for event
     */
    eventType: 'unknown' | 'added' | 'removed' | 'updated';
    /**
     * Document ids, that were added in the current snapshot
     */
    added: string[];
    /**
     * Document ids, that were removed in the current snapshot 
     */
    removed: string[];
    /**
     * Document ids, that were updated between since last snapshot evaluation
     */
    updated: string[];
    /**
     * Stringifyable represenation of the snapshot
     */
    plainSnap: { [key: string]: unknown };
    /**
     * Original snapshot object emitted by firebase lib
     */
    snap: firestore.QuerySnapshot;
    /**
     * Document ids present in the previous snapshot
     */
    prevIds: string[];
    /**
     * Time of previous latest change
     */
    prevLatestUpdate: number;
}

export class ChangeAccumulator {
    private collector: Subject<firestore.QuerySnapshot> = new Subject();

    private evaluated: Subject<any> = new Subject();

    next(snapshot: firestore.QuerySnapshot) {
        this.collector.next(snapshot);
    }

    get events() {
        return this.evaluated.asObservable();
    }

    get rawEvents() {
        return this.collector.asObservable();
    }

    constructor() {
        this.collector
            .pipe(
                scan((acc: ChangeAccumulatorEvent, snap: firestore.QuerySnapshot) => {
                    const ids = snap.docs.map(doc => doc.id);

                    const updateEvaluation = snap.docs
                        .reduce((chAcc, doc) => {
                            const updateTime = doc.updateTime.toDate().valueOf();
                            if (updateTime > acc.prevLatestUpdate) {
                                chAcc.docs.push(doc.id);
                                if (updateTime > chAcc.latestUpdateTime) {
                                    chAcc.latestUpdateTime = updateTime;
                                }
                            }
                            return chAcc;
                        }, {
                            latestUpdateTime: acc.prevLatestUpdate,
                            docs: [],
                        });

                    const updated: string[] = updateEvaluation.docs;

                    const added = ids.filter(id => acc.prevIds.indexOf(id) < 0);
                    const removed = acc.prevIds.filter(id => ids.indexOf(id) < 0);

                    const plainSnap = snap.docs.reduce((acc, doc) => ({
                        ...acc,
                        [doc.id]: doc.data(),
                    }), {});

                    let eventType = 'unknown';

                    if (added.length) {
                        eventType = 'added';
                    } else if (removed.length) {
                        eventType = 'removed';
                    } else {
                        eventType = 'updated';
                    }

                    const prevLatestUpdate = updateEvaluation.latestUpdateTime;

                    return {
                        eventType,
                        added,
                        removed,
                        updated,
                        plainSnap,
                        snap,
                        prevLatestUpdate,
                        prevIds: ids,
                    };
                }, {
                    eventType: null,
                    added: [],
                    removed: [],
                    updated: [],
                    plainSnap: null,
                    snap: null,
                    prevIds: [],
                    prevLatestUpdate: 0,
                })
            )
            .subscribe(this.evaluated);
    }
}
