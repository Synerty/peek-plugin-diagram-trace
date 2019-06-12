import {addTupleType, Tuple} from "@synerty/vortexjs";
import {diagramTraceTuplePrefix} from "../PluginNames";


@addTupleType
export class DiagramTraceTuple extends Tuple {
    public static readonly tupleName = diagramTraceTuplePrefix + "DiagramTraceTuple";

    //  Description of date1
    id : number;

    modelSetKey : string | null;
    coordSetKey : string | null;
    faIcon : string | null;
    title : string;
    url : string;

    constructor() {
        super(DiagramTraceTuple.tupleName)
    }
}