from vortex.handler.TupleDataObservableHandler import TupleDataObservableHandler

from peek_plugin_diagram_trace._private.PluginNames import diagramTraceFilt
from peek_plugin_diagram_trace._private.PluginNames import diagramTraceObservableName


def makeTupleDataObservableHandler(ormSessionCreator):
    """" Make Tuple Data Observable Handler

    This method creates the observable object, registers the tuple providers and then
    returns it.

    :param ormSessionCreator: A function that returns a SQLAlchemy session when called

    :return: An instance of :code:`TupleDataObservableHandler`

    """
    tupleObservable = TupleDataObservableHandler(
                observableName=diagramTraceObservableName,
                additionalFilt=diagramTraceFilt)

    return tupleObservable
