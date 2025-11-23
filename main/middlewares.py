from silk.middleware import SilkyMiddleware
from django.http import HttpRequest, Http404

class CustomSilkyMiddleware(SilkyMiddleware):
    def process_request(self, request: HttpRequest):
        if request.path.startswith('/silk'):
            if not request.user.is_superuser:
                raise Http404
        
        return super().process_request(request)