import {Injectable} from "@angular/core";

import {
    DiagramBranchService,
    DiagramCoordSetService,
    DiagramLookupService,
    DiagramOverrideService,
    diagramPluginName,
    DiagramToolbarService,
    ToolbarTypeE
} from "@peek/peek_plugin_diagram";

import {
    DocDbPopupActionI,
    DocDbPopupContextI,
    DocDbPopupService,
    DocDbPopupTypeE
} from "@peek/peek_plugin_docdb";

import {DiagramOverrideColor} from "@peek/peek_plugin_diagram/override";

import {DispColor} from "@peek/peek_plugin_diagram/lookups";
import {ComponentLifecycleEventEmitter, TupleSelector} from "@synerty/vortexjs";

import {
    GraphDbService,
    GraphDbTraceResultTuple,
    TraceConfigListItemI
} from "@peek/peek_plugin_graphdb";
import {Ng2BalloonMsgService} from "@synerty/ng2-balloon-msg";
import {diagramTraceTuplePrefix} from "../PluginNames";
import {PrivateDiagramTraceTupleService} from "./PrivateDiagramTraceTupleService";
import {
    MaxTraceVertexesPropertyName,
    SettingPropertyTuple,
    TraceColorsPropertyName
} from "../tuples/SettingPropertyTuple";

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

    private originalColorsByModelSet: { [key: string]: DispColor[] } = {};
    private colorsByModelSet: { [key: string]: DispColor[] } = {};

    private maxVertexes: number | null = null;

    constructor(private diagramCoordSetService: DiagramCoordSetService,
                private tupleService: PrivateDiagramTraceTupleService,
                private balloonMsg: Ng2BalloonMsgService,
                private diagramBranchService: DiagramBranchService,
                private objectPopupService: DocDbPopupService,
                private diagramToolbar: DiagramToolbarService,
                private diagramOverrideService: DiagramOverrideService,
                private graphDbService: GraphDbService,
                private diagramLookupService: DiagramLookupService) {
        super();

        this.clearTracesButtonKey = diagramTraceTuplePrefix
            + "diagramTraceTuplePrefix";

        if (this.diagramLookupService.isReady()) {
            this.setup();

        } else {
            this.diagramLookupService
                .isReadyObservable()
                .filter(ready => ready)
                .first()
                .takeUntil(this.onDestroyEvent)
                .subscribe(() => this.setup());

        }
    }


    private setup(): void {
        this.objectPopupService
            .popupObservable(DocDbPopupTypeE.summaryPopup)
            .filter((c: DocDbPopupContextI) => c.triggeredByPlugin == diagramPluginName)
            .takeUntil(this.onDestroyEvent)
            .subscribe((c: DocDbPopupContextI) => this.handlePopup(c));

        this.objectPopupService
            .popupObservable(DocDbPopupTypeE.detailPopup)
            .filter((c: DocDbPopupContextI) => c.triggeredByPlugin == diagramPluginName)
            .takeUntil(this.onDestroyEvent)
            .subscribe((c: DocDbPopupContextI) => this.handlePopup(c));

        // Remove all traces if the diagram goes into edit mode
        this.diagramBranchService
            .startEditingObservable()
            .takeUntil(this.onDestroyEvent)
            .subscribe(() => this.clearAllTraces());


        const settingsPropTs = new TupleSelector(
            SettingPropertyTuple.tupleName, {}
        );


        this.tupleService
            .tupleDataOfflineObserver
            .subscribeToTupleSelector(settingsPropTs)
            .takeUntil(this.onDestroyEvent)
            .subscribe((tuples: SettingPropertyTuple[]) => {
                for (const prop of tuples) {
                    switch (prop.key) {
                        case TraceColorsPropertyName: {
                            this.loadColors(prop.char_value);
                            break;
                        }
                        case MaxTraceVertexesPropertyName: {
                            this.maxVertexes = prop.int_value;
                            break;
                        }
                        default: {
                            // pass
                        }
                    }
                }
            });

    }

    private loadColors(colorString: string) {
        this.colorsByModelSet = {};
        this.originalColorsByModelSet = {};

        for (const modelSetKey of this.diagramCoordSetService.modelSetKeys()) {
            const colors = this.diagramLookupService
                .colorsOrderedByName(modelSetKey);
            const newColors = this.colorsByModelSet[modelSetKey] = [];

            // This is highly inefficient ...
            for (let colorStr of colorString.split(',')) {
                colorStr = colorStr.toLowerCase().trim();
                for (const c of colors) {
                    if (c.name.toLowerCase().trim() == colorStr) {
                        newColors.push(c);
                        break;
                    }
                }
            }

            this.originalColorsByModelSet[modelSetKey] = newColors.slice();
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

    private async handlePopup(context: DocDbPopupContextI): Promise<void> {
        if (context.key == null)
            return;

        if (this.originalColorsByModelSet[context.modelSetKey] == null
            || this.originalColorsByModelSet[context.modelSetKey].length == 0) {
            console.log(
                "ERROR: No matching trace colors, please configure in Peek Admin"
            );
            return;
        }

        const exists = await this.graphDbService
            .doesKeyExist(context.modelSetKey, context.key);

        if (!exists)
            return;

        let traceConfigs: TraceConfigListItemI[] = [];
        try {
            traceConfigs = await this.menusForModelSet(context.modelSetKey);

        } catch (e) {
            this.balloonMsg.showError(`ERROR: Diagram Trace ${e}`);
            return

        }

        if (traceConfigs == null || traceConfigs.length == 0)
            return;

        const rootMenu: DocDbPopupActionI = {
            name: null,
            tooltip: "Start a trace from this equipment",
            icon: 'highlighter',
            callback: null,
            children: [],
            closeOnCallback: false
        };

        for (const item of traceConfigs) {
            rootMenu.children.push({
                name: item.title,
                tooltip: `Trace type = ${item.name}`,
                icon: null,
                callback: () => this.menuClicked(item.key, context),
                children: [],
                closeOnCallback: true
            });
        }

        context.addAction(rootMenu);
    }


    private async menuClicked(traceKey: string, context: DocDbPopupContextI): Promise<void> {
        // const coordSetKey = context.options.triggeredForContext;

        let traceResult: GraphDbTraceResultTuple = null;
        try {
            traceResult = await this.graphDbService
                .getTraceResult(context.modelSetKey, traceKey,
                    context.key, this.maxVertexes);

        } catch (e) {
            this.balloonMsg.showError(`ERROR: Diagram Trace ${e}`);
            return

        }

        if (traceResult.traceAbortedMessage != null) {
            this.balloonMsg.showError(traceResult.traceAbortedMessage);
            return;
        }

        // Get the color and rotate the queue
        const colors = this.colorsByModelSet[context.modelSetKey];
        const color = colors.shift();
        colors.push(color);

        const override = new DiagramOverrideColor(context.modelSetKey, null);

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

        this.addClearTracesButton(context.modelSetKey);

    }

    private addClearTracesButton(modelSetKey: string) {
        if (this.appliedOverrides.length != 1)
            return;

        this.diagramToolbar.addToolButton(
            modelSetKey,
            null, {
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
        for (const modelSetKey of Object.keys(this.originalColorsByModelSet)) {
            this.colorsByModelSet[modelSetKey]
                = this.originalColorsByModelSet[modelSetKey].slice();
        }

        while (this.appliedOverrides.length != 0) {
            const override = this.appliedOverrides.pop();
            this.diagramOverrideService.removeOverride(override);
        }

        this.removeClearTracesButton();
    }
}