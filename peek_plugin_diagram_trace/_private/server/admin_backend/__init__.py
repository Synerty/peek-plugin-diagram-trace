from .DiagramTraceTableHandler import makeDiagramTraceTableHandler
from .SettingPropertyHandler import makeSettingPropertyHandler
from vortex.handler.TupleDataObservableHandler import TupleDataObservableHandler


def makeAdminBackendHandlers(tupleObservable: TupleDataObservableHandler,
                             dbSessionCreator):
    yield makeDiagramTraceTableHandler(tupleObservable, dbSessionCreator)

    yield makeSettingPropertyHandler(dbSessionCreator)
    pass
