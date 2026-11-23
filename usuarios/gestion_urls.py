from rest_framework.routers import SimpleRouter

from .gestion import UsuarioViewSet

router = SimpleRouter()
router.register("", UsuarioViewSet, basename="usuarios-gestion")

urlpatterns = router.urls
