import {Injectable, Optional} from "@angular/core";

import {
    DiagramItemPopupContextI,
    DiagramItemPopupService
} from "@peek/peek_plugin_diagram";
import {PrivateGenericTupleService} from "./PrivateGenericTupleService";
import {DiagramTraceTuple} from "../tuples/DiagramTraceTuple";
import {ComponentLifecycleEventEmitter, extend, TupleSelector} from "@synerty/vortexjs";

import {
    DocDbDocumentTypeTuple,
    DocDbPropertyTuple,
    DocDbService,
    DocumentResultI,
    DocumentTuple
} from "@peek/peek_plugin_docdb";

/** DMS Diagram Item Popup Service
 *
 * This service allows other plugins to add information to the item select popups.
 *
 * This is a helper service to simplify integrations with the diagram.
 *
 */
@Injectable()
export class PrivateTraceService extends ComponentLifecycleEventEmitter {

    private menus: DiagramTraceTuple [] = [];

    constructor(@Optional() private diagramPopup: DiagramItemPopupService,
                private tupleService: PrivateGenericTupleService,
                private docDbService: DocDbService) {
        super();

        this.tupleService.tupleDataOfflineObserver
            .subscribeToTupleSelector(new TupleSelector(DiagramTraceTuple.tupleName, {}))
            .subscribe((tuples: DiagramTraceTuple[]) => this.menus = tuples);


        if (this.diagramPopup != null) {
            this.diagramPopup
                .itemPopupObservable()
                .takeUntil(this.onDestroyEvent)
                .subscribe((context: DiagramItemPopupContextI) => {
                    this.handlePopup(context);
                });

        }


    }


    private handlePopup(context: DiagramItemPopupContextI): void {
        if (context.key == null)
            return;

        this.docDbService.getObjects("pofDiagram", [context.key])
            .then((docs: DocumentResultI) => {
                console.log(docs);
                let doc = docs[context.key];
                let contextCopy = extend({}, context);
                if (doc == null) {
                    console.log(`Document ${context.key} can not be found.`);
                } else {
                    contextCopy.data = extend({}, doc.document, contextCopy.data);
                }

                this.addMenus(contextCopy);
            });
    }

    private addMenus(context: DiagramItemPopupContextI): void {
        for (let menu of this.menus) {
            if (!(context.modelSetKey == menu.modelSetKey || menu.modelSetKey == null))
                continue;

            if (!(context.coordSetKey == menu.coordSetKey || menu.coordSetKey == null))
                continue;

            let url = menu.url;
            url = url.replace("{key}", context.key);

            let keys = Object.getOwnPropertyNames(context.data);
            for (let key of keys) {
                let val = context.data[key] == null ? '' : context.data[key];
                url = url.replace(`{${key}}`, val);
            }

            context.addMenuItem({
                name: menu.title,
                tooltip: null,
                icon: menu.faIcon,
                callback: () => this.menuClicked(menu, url),
                children: [],
                closeOnCallback: true
            });
        }
    }

    private menuClicked(menu: DiagramTraceTuple, url: string): void {
        window.open(url);
    }

}