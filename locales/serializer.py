#para transaccionar datos entre backend y frontend

from rest_framework import serializers
from locales.models import Local
from django.contrib.auth import get_user_model

User = get_user_model()


class LocalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Local
        fields = ['id', 'nombre', 'descripcion']

class TrabajadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'nombre', 'descripcion']
        fields = ['id', 'first_name', 'last_name', 'email']

