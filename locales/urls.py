from rest_framework.routers import SimpleRouter

from .api import LocalViewSet

router = SimpleRouter()
router.register("", LocalViewSet, basename="locales")

urlpatterns = router.urls
