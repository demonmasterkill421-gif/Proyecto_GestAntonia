#Permite devolver el archivo EXCEL
from django.http import HttpResponse 
from .exportarExcel import construir_excel #Estructura de excel



#Captura de errores y transacciones de datos
from django.core.exceptions import ValidationError as DjangoValidationError 
from django.db import IntegrityError, transaction




#Transformación de datos
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, viewsets



#Clases base
from rest_framework.decorators import action #Decorador de django rest: agrega una ruta extra a una viewset
from rest_framework.permissions import IsAuthenticated #Permiso de tener un token válido
from rest_framework.response import Response #Respuesta HTTP




#Importación de Modelos, Permissions y Serializer
from .models import RegistroDeVenta, SolicitudAnulacion #Modelo de la tabla de DB, leer y guardar
from .permissions import EsAdministrador, EsRecepcionista, MismoLocal #Reglas de acceso
from .serializers import (
    ResponderSolicitudSerializer,
    SolicitarAnulacionSerializer,
    SolicitudAnulacionSerializer,
    VentaSerializer,
) 





#Modelos de catálogo, para devolver la información de productos y servicios

from catalogo.models import Producto, Servicio
LIMITE_EXPORTAR = 20000 #En un excel no se exportan más de 20 mil ventas






#Convierte texto en fecha (GetQuerySet): Desde, hasta
#parse_date valida la fecha, si falla, no retorna nada.

def _fecha_o_none(texto): 
    try:
        return parse_date(texto or "")
    except ValueError:
        return None



#Arma una respuesta de error con un código de HTTP
def _error(texto, codigo=400): 
    return Response({"detail": texto}, status=codigo)









#Venta Viewset
class VentaViewSet(viewsets.ModelViewSet):

    serializer_class = VentaSerializer #Serializer que valida las entradas
    permission_classes = [IsAuthenticated, EsRecepcionista, MismoLocal] #Valida que sea administrador o recepcionista, que sea un recepcionista y que tenga el mismo local.
    http_method_names = ["get", "post", "head", "options"] #Métodos HTTP válidos


    #Función que obtiene los permisos
    def get_permissions(self):
        if self.action == "anular": #¿la acción es anular?
            return [IsAuthenticated(), EsAdministrador(), MismoLocal()] #
        return super().get_permissions() #Devuelve permisos normales de permission_classes, la petición se rechaza.

    
    #Función que delimita las ventas que ve cada persona
    def get_queryset(self):

        #Obtiene todas las ventas
        qs = RegistroDeVenta.objects.select_related("local").prefetch_related("detalles")
        #Recibe la petición de la API y guarda el dicc del usuario
        user = self.request.user




        desde = _fecha_o_none(self.request.query_params.get("desde"))
        hasta = _fecha_o_none(self.request.query_params.get("hasta"))



        if desde:
            qs = qs.filter(fecha__date__gte=desde)
        if hasta:
            qs = qs.filter(fecha__date__lte=hasta)


        if user.rol == "ADMIN":
            local = self.request.query_params.get("local")
            return qs.filter(local_id=local) if local else qs

        return qs.filter(local=user.local)




    #REGISTRAR VENTA__________________________________________________________

    def perform_create(self, serializer):  
        #Obtiene al usuario de la petición del token
        user = self.request.user


        #Si es admin, usa el local de la venta, o el del usuario.
        if user.rol == "ADMIN": 
            local = serializer.validated_data.get("local") or user.local

        else:
            local = user.local

        if local is None: #Si no hay local, retorna un error que lo ingrese
            raise serializers.ValidationError({"local":"Indique el local de la venta"})


        #SE GUARDA LA VENTA
        serializer.save(recepcionista=user, local=local)








    #ANULAR VENTA__________________________________________________________________________

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        """La administradora anula una venta confirmada. Exige un motivo y devuelve el stock."""
        venta = self.get_object()

        datos = SolicitarAnulacionSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        motivo = datos.validated_data["motivo"]

        try:
            with transaction.atomic():
                # Se bloquea la venta para que nadie más la anule al mismo tiempo
                bloqueada = RegistroDeVenta.objects.select_for_update().get(pk=venta.pk)
                bloqueada.anular()

                ahora = timezone.now()

                # Si la recepcionista había pedido anularla, ese pedido queda aprobado
                SolicitudAnulacion.objects.filter(
                    venta=bloqueada, estado=SolicitudAnulacion.Estado.PENDIENTE
                ).update(
                    estado=SolicitudAnulacion.Estado.APROBADA,
                    resuelta_por=request.user,
                    fecha_resolucion=ahora,
                    respuesta="La administradora anuló la venta directamente.",
                )

                # Queda el registro de quién anuló, cuándo y por qué
                SolicitudAnulacion.objects.create(
                    venta=bloqueada,
                    solicitante=request.user,
                    motivo=motivo,
                    estado=SolicitudAnulacion.Estado.APROBADA,
                    resuelta_por=request.user,
                    fecha_resolucion=ahora,
                    respuesta="Anulada directamente por la administradora.",
                )
        except DjangoValidationError as e:
            return _error(" ".join(e.messages))

        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=["post"], url_path="solicitar-anulacion")
    def solicitar_anulacion(self, request, pk=None):
        """La recepcionista pide anular una venta confirmada de su local. La administradora decide."""
        if request.user.rol == "ADMIN":
            return _error("La administradora anula las ventas directamente.", 403)

        venta = self.get_object()

        datos = SolicitarAnulacionSerializer(data=request.data)
        datos.is_valid(raise_exception=True)

        if venta.estado != RegistroDeVenta.Estado.CONFIRMADA:
            return _error("Solo se puede pedir la anulación de una venta confirmada.")

        if venta.solicitudes_anulacion.filter(estado=SolicitudAnulacion.Estado.PENDIENTE).exists():
            return _error("Esta venta ya tiene una solicitud de anulación pendiente.")

        try:
            with transaction.atomic():
                solicitud = SolicitudAnulacion.objects.create(
                    venta=venta,
                    solicitante=request.user,
                    motivo=datos.validated_data["motivo"],
                )
        except IntegrityError:
            # Dos pedidos al mismo tiempo: la base de datos deja pasar solo uno
            return _error("Esta venta ya tiene una solicitud de anulación pendiente.")

        solicitud = SolicitudAnulacion.objects.select_related(
            "venta__local", "solicitante", "resuelta_por"
        ).get(pk=solicitud.pk)
        return Response(SolicitudAnulacionSerializer(solicitud).data, status=201)

    @action(detail=False, methods=["post"])
    def exportar(self, request):
        """Excel con las ventas indicadas (las que la administradora ve filtradas). Solo ADMIN."""
        if request.user.rol != "ADMIN":
            return Response({"detail": "Solo la administradora puede exportar ventas."}, status=403)

        ids = request.data.get("ids")
        if (
            not isinstance(ids, list)
            or not ids
            or len(ids) > LIMITE_EXPORTAR
            or not all(isinstance(i, int) for i in ids)
        ):
            return Response({"detail": "No hay ventas para exportar."}, status=400)

        ventas = (
            self.get_queryset()
            .filter(id__in=ids)
            .exclude(estado="BORRADOR")
            .prefetch_related("detalles__item", "detalles__trabajador")
            .order_by("-fecha")
        )

        respuesta = HttpResponse(
            construir_excel(ventas),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        respuesta["Content-Disposition"] = 'attachment; filename="ventas.xlsx"'
        return respuesta

    @action(detail=False, methods=["get"])
    def servicios(self, request):
        datos = Servicio.objects.filter(activo=True).order_by("nombre").values(
            "id", "nombre", "precio", "duracion", "tipo"
        )
        return Response(list(datos))

    @action(detail=False, methods=["get"])
    def productos(self, request):
        """Productos de venta e insumos activos, con el stock del local del usuario."""
        local = request.user.local if request.user.local_id else None
        datos = []
        for p in Producto.objects.filter(activo=True).order_by("nombre"):
            datos.append({
                "id": p.id,
                "nombre": p.nombre,
                "tipo": p.tipo,  # "VENTA" o "INSUMO"
                "precio": 0 if p.tipo == Producto.Tipo.INSUMO else p.precio,
                "stock": p.stock_en(local) if local else None,
            })
        return Response(datos)















class SolicitudAnulacionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Solicitudes de anulación.
    - La administradora ve todas (puede filtrar por ?estado= y ?local=) y las aprueba o rechaza.
    - La recepcionista ve solo las que ella pidió.
    """
    serializer_class = SolicitudAnulacionSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista]

    def get_permissions(self):
        if self.action in ("aprobar", "rechazar"):
            return [IsAuthenticated(), EsAdministrador()]
        return super().get_permissions()

    def get_queryset(self):
        qs = SolicitudAnulacion.objects.select_related("venta__local", "solicitante", "resuelta_por")
        user = self.request.user

        if user.rol != "ADMIN":
            return qs.filter(solicitante=user)

        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)

        local = self.request.query_params.get("local")
        if local:
            qs = qs.filter(venta__local_id=local)

        return qs

    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        """Aprueba el pedido: anula la venta (devuelve el stock) y cierra la solicitud."""
        solicitud = self.get_object()

        datos = ResponderSolicitudSerializer(data=request.data)
        datos.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                bloqueada = SolicitudAnulacion.objects.select_for_update().get(pk=solicitud.pk)
                if bloqueada.estado != SolicitudAnulacion.Estado.PENDIENTE:
                    return _error("Esta solicitud ya fue resuelta.")

                venta = RegistroDeVenta.objects.select_for_update().get(pk=bloqueada.venta_id)
                venta.anular()

                bloqueada.estado = SolicitudAnulacion.Estado.APROBADA
                bloqueada.resuelta_por = request.user
                bloqueada.fecha_resolucion = timezone.now()
                bloqueada.respuesta = datos.validated_data.get("respuesta", "")
                bloqueada.save(update_fields=["estado", "resuelta_por", "fecha_resolucion", "respuesta"])
        except DjangoValidationError as e:
            return _error(" ".join(e.messages))

        solicitud.refresh_from_db()
        return Response(self.get_serializer(solicitud).data)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        """Rechaza el pedido: la venta queda como estaba."""
        solicitud = self.get_object()

        datos = ResponderSolicitudSerializer(data=request.data)
        datos.is_valid(raise_exception=True)

        with transaction.atomic():
            bloqueada = SolicitudAnulacion.objects.select_for_update().get(pk=solicitud.pk)
            if bloqueada.estado != SolicitudAnulacion.Estado.PENDIENTE:
                return _error("Esta solicitud ya fue resuelta.")

            bloqueada.estado = SolicitudAnulacion.Estado.RECHAZADA
            bloqueada.resuelta_por = request.user
            bloqueada.fecha_resolucion = timezone.now()
            bloqueada.respuesta = datos.validated_data.get("respuesta", "")
            bloqueada.save(update_fields=["estado", "resuelta_por", "fecha_resolucion", "respuesta"])

        solicitud.refresh_from_db()
        return Response(self.get_serializer(solicitud).data)