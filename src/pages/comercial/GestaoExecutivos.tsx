import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, UserPlus, UserCog, Shield } from 'lucide-react';

const GestaoExecutivos = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Executivos</h1>
        <p className="text-muted-foreground">Administração da equipe comercial</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader className="flex flex-row items-center space-x-4">
            <UserPlus className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-lg">Novo Executivo</CardTitle>
              <p className="text-sm text-muted-foreground">Cadastrar novo membro</p>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader className="flex flex-row items-center space-x-4">
            <UserCog className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-lg">Editar Executivo</CardTitle>
              <p className="text-sm text-muted-foreground">Alterar dados e permissões</p>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader className="flex flex-row items-center space-x-4">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-lg">Permissões</CardTitle>
              <p className="text-sm text-muted-foreground">Gerenciar acessos</p>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" style={{ animationDuration: '3s' }} />
            <p>Módulo de gestão de executivos em desenvolvimento.</p>
            <p className="text-sm mt-2">
              Funcionalidades planejadas: cadastro, metas individuais, territórios, hierarquia.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestaoExecutivos;
