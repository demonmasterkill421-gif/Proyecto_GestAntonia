from rest_framework.routers import DefaultRouter

from .views import AsistenciaViewSet

router = DefaultRouter()
router.register("asistencias", AsistenciaViewSet, basename="asistencia")

urlpatterns = router.urls