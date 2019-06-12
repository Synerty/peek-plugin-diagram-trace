from sqlalchemy import Column
from sqlalchemy import Integer, String
from vortex.Tuple import Tuple, addTupleType

from peek_plugin_diagram_trace._private.PluginNames import diagramTraceTuplePrefix
from peek_plugin_diagram_trace._private.storage.DeclarativeBase import DeclarativeBase


@addTupleType
class DiagramTraceTuple(Tuple, DeclarativeBase):
    __tupleType__ = diagramTraceTuplePrefix + 'DiagramTraceTuple'
    __tablename__ = 'DiagramTrace'

    id = Column(Integer, primary_key=True, autoincrement=True)
    modelSetKey = Column(String)
    coordSetKey = Column(String)
    faIcon = Column(String)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)