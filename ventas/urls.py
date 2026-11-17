from rest_framework.routers import DefaultRouter

from .views import SolicitudAnulacionViewSet, VentaViewSet

router = DefaultRouter()
router.register("ventas", VentaViewSet, basename="venta")
router.register("solicitudes-anulacion", SolicitudAnulacionViewSet, basename="solicitud-anulacion")

urlpatterns = router.urls