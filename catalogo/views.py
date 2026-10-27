from django.shortcuts import render
from django.db.models import Sum,F

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido
from .models import Inventario


@rol_requerido(Usuario.Rol.ADMINISTRADOR)
def inventario(request):
    busqueda = request.GET.get("buscar","").strip()

    inventarios = Inventario.objects.select_related(
        "producto", "local"
    )

    total_productos = inventarios.values("producto").distinct().count()

    stock_total = inventarios.aggregate(
        total=Sum("cantidad")
    )["total"] or 0

    stock_bajo = inventarios.filter(
        cantidad__lte=F("stock_minimo")
    ).count()

    registros = inventarios.order_by(
        "producto__nombre", "local__nombre"
    )

    if busqueda:
        registros = registros.filter(
            producto__nombre__icontains=busqueda
        )

    return render(
        request,
        "catalogo/inventario.html",
        {
            "registros":registros,
            "busqueda":busqueda,
            "total_productos":total_productos,
            "stock_total":stock_total,
            "stock_bajo":stock_bajo,

         },
    )
