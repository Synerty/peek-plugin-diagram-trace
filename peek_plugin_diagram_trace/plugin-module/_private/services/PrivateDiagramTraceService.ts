import {Injectable} from "@angular/core";

import {
    DiagramItemPopupContextI,
    DiagramItemPopupService,
    DiagramLookupService,
    DiagramMenuItemI,
    DiagramOverrideService,
    DiagramToolbarService,
    ToolbarTypeE
} from "@peek/peek_plugin_diagram";

import {DiagramOverrideColor} from "@peek/peek_plugin_diagram/override";
import {ComponentLifecycleEventEmitter} from "@synerty/vortexjs";

import {
    GraphDbService,
    GraphDbTraceResultTuple,
    TraceConfigListItemI
} from "@peek/peek_plugin_graphdb";
import {Ng2BalloonMsgService} from "@synerty/ng2-balloon-msg";
import {diagramTraceTuplePrefix} from "../PluginNames";

/** DMS Diagram Item Popup Service
 *
 * This service allows other plugins to add information to the item select popups.
 *
 * This is a helper service to simplify integrations with the diagram.
 *
 */
@Injectable()
export class PrivateDiagramTraceService extends ComponentLifecycleEventEmitter {

    private traceConfigsByModelSetKey: { [modelSetKey: string]: TraceConfigListItemI[] } = {};

    private appliedOverrides: DiagramOverrideColor[] = [];

    private readonly clearTracesButtonKey: string;

    constructor(private balloonMsg: Ng2BalloonMsgService,
                private diagramPopup: DiagramItemPopupService,
                private diagramToolbar: DiagramToolbarService,
                private diagramOverrideService: DiagramOverrideService,
                private graphDbService: GraphDbService,
                private diagramLookupService: DiagramLookupService) {
        super();

        this.clearTracesButtonKey = diagramTraceTuplePrefix
            + "diagramTraceTuplePrefix";

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
                    closeOnCallback: false
                };

                for (const item of traceConfigs) {
                    rootMenu.children.push({
                        name: item.name,
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
                break;
            }
        }

        this.graphDbService
            .getTraceResult(context.modelSetKey, traceKey, context.key)
            .then((traceResult: GraphDbTraceResultTuple) => {
                const override = new DiagramOverrideColor(
                    context.modelSetKey, context.coordSetKey
                );
                override.setLineColor(color);
                override.setColor(color);

                for (let edge of traceResult.edges) {
                    override.addDispKeys([edge.key]);
                }

                for (let vertex of traceResult.edges) {
                    override.addDispKeys([vertex.key]);
                }

                this.diagramOverrideService.applyOverride(override);
                this.appliedOverrides.push(override);

                this.addClearTracesButton(context.modelSetKey, context.coordSetKey);
            })
            .catch(e => this.balloonMsg.showError(`ERROR: Diagram Trace ${e}`));

    }

    private addClearTracesButton(modelSetKey: string, coordSetKey: string) {
        if (this.appliedOverrides.length != 1)
            return;

        this.diagramToolbar.addToolButton(
            modelSetKey,
            coordSetKey, {
                key: this.clearTracesButtonKey,
                name: "Clear Traces",
                tooltip: "Clear Traces",
                icon: 'eraser',
                callback: () => this.clearAllTraces(),
                children: []
            },
            ToolbarTypeE.ViewToolbar);
    }

    private removeClearTracesButton() {
        if (this.appliedOverrides.length != 0)
            return;

        this.diagramToolbar.removeToolButton(this.clearTracesButtonKey);
    }

    private clearAllTraces(): void {
        while (this.appliedOverrides.length != 0) {
            const override = this.appliedOverrides.pop();
            this.diagramOverrideService.removeOverride(override);
        }

        this.removeClearTracesButton();
    }
}