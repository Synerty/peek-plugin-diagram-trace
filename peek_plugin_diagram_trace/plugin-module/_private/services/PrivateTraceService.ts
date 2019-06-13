import {Injectable} from "@angular/core";

import {
    DiagramItemPopupContextI,
    DiagramItemPopupService,
    DiagramLookupService,
    DiagramMenuItemI,
    DiagramOverrideService
} from "@peek/peek_plugin_diagram";

import {DiagramOverrideColor} from "@peek/peek_plugin_diagram/override";
import {ComponentLifecycleEventEmitter} from "@synerty/vortexjs";

import {
    GraphDbService,
    GraphDbTraceResultTuple,
    TraceConfigListItemI
} from "@peek/peek_plugin_graphdb";

/** DMS Diagram Item Popup Service
 *
 * This service allows other plugins to add information to the item select popups.
 *
 * This is a helper service to simplify integrations with the diagram.
 *
 */
@Injectable()
export class PrivateTraceService extends ComponentLifecycleEventEmitter {

    private traceConfigsByModelSetKey: { [modelSetKey: string]: TraceConfigListItemI[] } = {};

    private appliedOverrides: DiagramOverrideColor[] = [];

    constructor(private diagramPopup: DiagramItemPopupService,
                private diagramOverrideService: DiagramOverrideService,
                private graphDbService: GraphDbService,
                private diagramLookupService: DiagramLookupService) {
        super();

        if (this.diagramPopup != null) {
            this.diagramPopup
                .itemPopupObservable()
                .takeUntil(this.onDestroyEvent)
                .subscribe((context: DiagramItemPopupContextI) => {
                    this.handlePopup(context);
                });

        }

    }

    private menusForModelSet(modelSetKey: string): Promise<TraceConfigListItemI[]> {
        if (this.traceConfigsByModelSetKey[modelSetKey] != null)
            return Promise.resolve(this.traceConfigsByModelSetKey[modelSetKey]);

        return new Promise<TraceConfigListItemI[]>((resolve, reject) => {
            this.graphDbService
                .traceConfigListItemsObservable(modelSetKey)
                .takeUntil(this.onDestroyEvent)
                .subscribe((tuples: TraceConfigListItemI[]) => {
                    this.traceConfigsByModelSetKey[modelSetKey] = tuples;
                    resolve(tuples);
                });
        })
    }


    private handlePopup(context: DiagramItemPopupContextI): void {
        if (context.key == null)
            return;

        this.menusForModelSet(context.modelSetKey)
            .then((traceConfigs: TraceConfigListItemI[]) => {
                if (traceConfigs == null || traceConfigs.length == 0)
                    return;

                const rootMenu: DiagramMenuItemI = {
                    name: "Trace",
                    tooltip: "Start a trace from this component",
                    icon: null,
                    callback: null,
                    children: [],
                    closeOnCallback: true
                };

                for (const item of traceConfigs) {
                    rootMenu.children.push({
                        name: "Trace",
                        tooltip: "Start a trace from this component",
                        icon: null,
                        callback: () => this.menuClicked(item.key, context),
                        children: [],
                        closeOnCallback: true
                    });
                }

                context.addMenuItem(rootMenu);
            })
            .catch(e => console.log(`ERROR: Diagram Trace ${e}`));
    }


    private menuClicked(traceKey: string, context: DiagramItemPopupContextI): void {

        const colors = this.diagramLookupService
            .colorsOrderedByName(context.modelSetKey);

        let color = null;
        for (const c of colors) {
            if (c.color == "green") {
                color = c;
                return;
            }
        }

        this.graphDbService
            .getTraceResult(context.modelSetKey, traceKey, context.key)
            .then((traceResult: GraphDbTraceResultTuple) => {
                const override = new DiagramOverrideColor(
                    context.modelSetKey, context.coordSetKey
                );
                override.setLineColor(color);

                for (let edge of traceResult.edges) {
                    override.addDispKeys([edge.key]);
                }

                for (let vertex of traceResult.edges) {
                    override.addDispKeys([vertex.key]);
                }

                this.diagramOverrideService.applyOverride(override);
                this.appliedOverrides.push(override);
            })
            .catch(e => console.log(`ERROR: Diagram Trace ${e}`));


    }
}