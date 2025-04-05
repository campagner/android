import React, { useState, useEffect } from 'react';
import { Switch, StyleSheet,  View,  FlatList,  TouchableOpacity,  TextInput,  Modal,  Button,  Alert,  Text,  Platform, Linking, ScrollView} from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import moment from 'moment';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import atcoImage from './assets/radar.png';
import * as FileSystem from 'expo-file-system';
import { Calendar } from 'react-native-calendars';
import * as Notifications from 'expo-notifications';
import { FAB } from 'react-native-paper';
import { ActivityIndicator} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SGPOImage from './assets/SGPO.png';
import CEUimage from './assets/ceu.png';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import SobreScreen from './SobreScreen';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = Date.now();
  console.log(`Tarefa de background executada: ${new Date(now).toISOString()}`);

  try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (fileInfo.exists) {
          const conteudo = await FileSystem.readAsStringAsync(FILE_URI);
          const dados = JSON.parse(conteudo);
          for (const pessoa of dados) {
              await verificarEEnviarNotificacao(pessoa);
          }
      }
  } catch (erro) {
      console.error('Erro ao carregar dados na tarefa de background:', erro);
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

async function registerBackgroundFetchAsync() {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (registered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    }
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 86400, // 24 horas
      stopOnTerminate: false, // Não interromper a tarefa ao fechar o app
      startOnBoot: true, // Iniciar a tarefa ao ligar o dispositivo
    });
    console.log('Tarefa de background registrada');
  } catch (error) {
    console.error('Erro ao registrar tarefa de background:', error);
  }
}

const Stack = createStackNavigator();
const FILE_URI = FileSystem.documentDirectory + 'pessoas.json';
const SGPO_LINK = 'https://servicos.decea.mil.br/sgpo/gerencial/index.cfm';

// Configuração de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Falha ao obter token de push!');
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync()).data;
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

const schedulePushNotification = async (controlador) => {
  console.log(`Agendando notificação para ${controlador.nome}`);
  console.log(`Notificações habilitadas: ${controlador.notificationsEnabled}`);

  const notificationId = uuidv4(); // Gere um notificationId único

  if (!controlador.notificationsEnabled) {
    console.log(`Notificações desabilitadas para ${controlador.nome}.`);
    return notificationId; // Retorne o notificationId gerado
  }

  const vencimento = moment(controlador.vencimento);
  const agora = moment();
  const diasRestantes = vencimento.diff(agora, 'days');
  console.log(`Dias restantes para ${controlador.nome}: ${diasRestantes}`);

  if (diasRestantes <= 50) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Alerta de Vencimento de CMA',
            body: `O CMA de ${controlador.nome} vence(u) em ${vencimento.format('DD/MM/YYYY')}`,
            data: { data: 'dados vão aqui' },
          },
          trigger: {
            date: vencimento.toDate(), // Agendar para o dia do vencimento
            repeats: true, // Repetir a cada 24 horas
          },
        });
        console.log(`Notificação agendada para ${controlador.nome}. ID: ${notificationId}`);
      } catch (error) {
        console.error(`Erro ao agendar notificação para ${controlador.nome}:`, error);
      }
    } else {
      console.log(`Permissões de notificação não concedidas para ${controlador.nome}.`);
    }
  } else {
    console.log(
      `Não foi necessário agendar notificação para ${controlador.nome}. Dias restantes: ${diasRestantes}`
    );
  }

  return notificationId; // Retorne o notificationId gerado
};

const verificarEEnviarNotificacao = async (controlador) => {
  const vencimento = moment(controlador.vencimento);
  const agora = moment();
  const diasRestantes = vencimento.diff(agora, 'days');

  if (diasRestantes <= 50) {
      if (controlador.notificationsEnabled) { // Adicionado a verificação aqui para avaliar o liga desliga do card
          const { status } = await Notifications.getPermissionsAsync();
          if (status === 'granted') {
              try {
                  await Notifications.scheduleNotificationAsync({
                      content: {
                          title: 'Alerta de Vencimento de CMA',
                          body: `O CMA de ${controlador.nome} vence em ${vencimento.format('DD/MM/YYYY')}`,
                          data: { data: 'dados vão aqui' },
                      },
                      trigger: null, // Notificação imediata, sem repetição nesse bloco, porém a função aqui chamada é repetida a cada 24horas pela função "mae"
                  });
                  console.log(`Notificação enviada para ${controlador.nome} em background.`);
              } catch (erro) {
                  console.error(`Erro ao enviar notificação para ${controlador.nome} em background:`, erro);
              }
          } else {
              console.log(`Permissões de notificação não concedidas para ${controlador.nome} em background.`);
          }
      } else {
          console.log(`Notificações desabilitadas para ${controlador.nome} em background.`);
      }
  }
};

const toggleNotifications = async (controlador, pessoas, setPessoas, salvarDados) => {
  try {
      const novosDadosPromises = pessoas.map((pessoa) => {
          if (pessoa.nome === controlador.nome && pessoa.LPNA === controlador.LPNA) {
              if (pessoa.notificationId && pessoa.notificationsEnabled) {
                  return Notifications.cancelScheduledNotificationAsync(pessoa.notificationId)
                      .then(() => {
                          return {
                              ...pessoa,
                              notificationsEnabled: !pessoa.notificationsEnabled,
                          };
                      })
                      .catch((error) => {
                          console.error('Erro ao cancelar notificação:', error);
                          // Retorna o objeto pessoa original em caso de erro
                          return pessoa;
                      });
              } else {
                  return {
                      ...pessoa,
                      notificationsEnabled: !pessoa.notificationsEnabled,
                  };
              }
          }
          return pessoa;
      });

      const novosDados = await Promise.all(novosDadosPromises);
      await salvarDados(novosDados);
      setPessoas(novosDados);
  } catch (error) {
      console.error('Erro ao alternar notificações:', error);
  }
};
  
function HomeScreen({ navigation }) {
  const [numeroAtcos, setNumeroAtcos] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      carregarDados();
    }, [])
  );

  const carregarDados = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      let dados;
      if (fileInfo.exists) {
        const conteudo = await FileSystem.readAsStringAsync(FILE_URI);
        dados = JSON.parse(conteudo);
      } else {
        dados = require('./assets/pessoas.json');
        await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify(dados));
      }
      setNumeroAtcos(dados.length); // Conta o número de ATCOs
      dados.forEach((controlador) => {
        if (controlador.notificationsEnabled === undefined) {
          controlador.notificationsEnabled = true;
        }
        if (controlador.cardVisible === undefined) {
          controlador.cardVisible = true;
        }
      });
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
    }
  };
  const abrirSGPO = () => {
    Linking.openURL(SGPO_LINK);
  };
  return (
    <ScrollView style={styles.container}
    contentContainerStyle={styles.contentContainer}>
      <TouchableOpacity onPress={() => navigation.navigate('Controladores')}>
        <Card style={styles.card}>
          <Card.Cover source={atcoImage} />
          <Card.Content>
            <Title>Lista de ATCOs</Title>
            <Paragraph>Número de ATCOs cadastrados: <Paragraph style={styles.numeroAtcos}>{numeroAtcos}</Paragraph></Paragraph>
          </Card.Content>
        </Card>
      </TouchableOpacity>
      <TouchableOpacity onPress={abrirSGPO}>
        <Card style={styles.card}>
          <Card.Cover source={SGPOImage} />
          <Card.Content>
            <Title>SGPO - DECEA</Title>
            <Paragraph>Abrir no navegador</Paragraph>
          </Card.Content>
        </Card>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Sobre')}>
        <Card style={styles.card}>
        <Card.Cover source={CEUimage} />
          <Card.Content>
            <Title>Sobre</Title>
            <Paragraph>Informações sobre o aplicativo</Paragraph>
          </Card.Content>
        </Card>
      </TouchableOpacity>
      </ScrollView>
  );
}

function ControladoresDNVTScreen() {
  const [pessoas, setPessoas] = useState([]);
  const [modalEdicaoVisible, setModalEdicaoVisible] = useState(false);
  const [modalAdicaoVisible, setModalAdicaoVisible] = useState(false);
  const [pessoaEditando, setPessoaEditando] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [lpnaEditado, setLpnaEditado] = useState('');
  const [vencimentoEditado, setVencimentoEditado] = useState('');
  const [termoBusca, setTermoBusca] = useState('');
  const [novoControlador, setNovoControlador] = useState({
    nome: '',
    LPNA: '',
    vencimento: '',
    notificationsEnabled: true,
  });
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [carregando, setCarregando] = useState(false); // Adicione o estado carregando

  useEffect(() => {
    carregarDados();
    registerForPushNotificationsAsync();
    registerBackgroundFetchAsync(); // Registra a tarefa de background
  
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log(notification);
    });
  
    return () => {
      subscription.remove();
    };
  }, []);

  const carregarDados = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      let dados;
      if (fileInfo.exists) {
        const conteudo = await FileSystem.readAsStringAsync(FILE_URI);
        dados = JSON.parse(conteudo);
      } else {
        dados = require('./assets/pessoas.json');
        await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify(dados));
      }
  
      //campo notificationsEnabled
      dados.forEach((controlador) => {
        if (controlador.notificationsEnabled === undefined) {
          controlador.notificationsEnabled = true;
        }
      });
  
      // Ordenar os dados por data de vencimento
      dados.sort((a, b) => {
        return moment(a.vencimento).diff(moment(b.vencimento));
      });
  
      setPessoas(dados);
      console.log('Dados carregados:', dados);
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
    }
  };
  const salvarDados = async (novosDados) => {
    try {
        console.log('Salvando dados:', novosDados); // Log de depuração
        await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify(novosDados));
        console.log('Dados salvos com sucesso.'); // Log de depuração
        carregarDados();
    } catch (erro) {
        console.error('Erro ao salvar dados:', erro);
    }
};

  const calcularDiasParaVencimento = (dataVencimento) => {
    const hoje = moment();
    const vencimento = moment(dataVencimento);
    const diferencaEmDias = vencimento.diff(hoje, 'days');
    return diferencaEmDias;
  };

  const exibirAlerta = (dias) => {
    if (dias <= 50 && dias >= 0) {
      return <Text style={styles.alerta}>ALERTA!</Text>;
    } else if (dias < 0) {
      return <Text style={styles.vencido}>VENCEU A PARADA!</Text>;
    }
    return null;
  };

  const filtrarControladores = () => {
    return pessoas.filter((pessoa) => {
      return pessoa.nome.toLowerCase().includes(termoBusca.toLowerCase());
    });
  };

  const abrirModalEdicao = (pessoa) => {
    setPessoaEditando(pessoa);
    setNomeEditado(pessoa.nome);
    setLpnaEditado(pessoa.LPNA);
    setVencimentoEditado(pessoa.vencimento);
    setDataSelecionada(pessoa.vencimento);
    setModalEdicaoVisible(true);
  };

  const abrirModalNovoControlador = () => {
    setCarregando(true); // Inicie a tela de carregamento
    setTimeout(() => {
      setNovoControlador({ nome: '', LPNA: '', vencimento: '' });
      setDataSelecionada('');
      setModalAdicaoVisible(true);
      setCarregando(false); // Finalize a tela de carregamento
    }, 0); // Atraso de x segundos (x000 milissegundos)
  };

  const salvarEdicao = async () => {
    try {
        if (pessoaEditando.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(pessoaEditando.notificationId);
        }
        const notificationId = await schedulePushNotification({
            ...pessoaEditando,
            vencimento: vencimentoEditado,
        });
        const novosDados = pessoas.map((pessoa) => {
            if (pessoa.nome === pessoaEditando.nome && pessoa.LPNA === pessoaEditando.LPNA) {
                return {
                    ...pessoa,
                    nome: nomeEditado,
                    LPNA: lpnaEditado,
                    vencimento: vencimentoEditado,
                    notificationId: notificationId,
                };
            }
            return pessoa;
        });
        await salvarDados(novosDados);
        setPessoas(novosDados);
        setModalEdicaoVisible(false);
    } catch (erro) {
        console.error('Erro ao salvar edição:', erro);
        Alert.alert('Erro', 'Ocorreu um erro ao salvar a edição.');
    }
};
const excluirControlador = (controlador) => {
  Alert.alert(
      'Excluir Controlador',
      'Tem certeza que deseja excluir esse maluco?',
      [
          {
              text: 'Cancelar',
              style: 'cancel',
          },
          {
              text: 'Excluir',
              onPress: async () => { // Adicionando async aqui
                  if (controlador.notificationId) {
                      await Notifications.cancelScheduledNotificationAsync(controlador.notificationId);
                  }
                  const novosDados = pessoas.filter((p) => p !== controlador);
                  await salvarDados(novosDados);
              },
          },
      ]
  );
};

<TouchableOpacity style={styles.customButton} onPress={abrirModalNovoControlador}>
  <Text style={styles.customButtonText}>Adicionar Controlador</Text>
</TouchableOpacity>

const adicionarNovoControlador = async () => {
  if (!novoControlador.nome || !novoControlador.LPNA || !novoControlador.vencimento) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
  }

  try {
      // Atualizado novoControlador para incluir notificationsEnabled: true ANTES DE CHAMAR schedulePushNotification
      const controladorComNotificacoes = {
          ...novoControlador,
          notificationsEnabled: true
      };

      const notificationId = await schedulePushNotification(controladorComNotificacoes);

      if (notificationId) {
          setPessoas((prevPessoas) => {
              const novosDados = [
                  ...prevPessoas,
                  {
                      nome: novoControlador.nome,
                      LPNA: novoControlador.LPNA,
                      vencimento: novoControlador.vencimento,
                      notificationId: notificationId,
                      notificationsEnabled: true,
                  },
              ];
              salvarDados(novosDados);
              return novosDados;
          });
      } else {
          console.log(
              `Não foi possível agendar a notificação para ${novoControlador.nome}.`
          );
      }
  } catch (error) {
      console.error('Erro ao adicionar novo controlador:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao adicionar o controlador.');
  } finally {
      setModalAdicaoVisible(false);
      setNovoControlador({ nome: '', LPNA: '', vencimento: '' });
      setDataSelecionada('');
      setCarregando(false);
  }
};
return (
  <View style={styles.container}>
    <TextInput
        style={styles.buscaInput}
        placeholder="Buscar por nome"
        value={termoBusca}
        onChangeText={setTermoBusca}
      />
    <FlatList
        data={filtrarControladores()}
        keyExtractor={(item, index) => index.toString()}
      renderItem={({ item }) => {
        return (
          <TouchableOpacity onPress={() => abrirModalEdicao(item)}>
            <Card style={styles.card}>
              <Card.Content>
                <Title>{item.nome}</Title>
                <Paragraph>LPNA: {item.LPNA}</Paragraph>
                <Text>
                  Vencimento do CMA: {moment(item.vencimento).format('DD/MM/YYYY')}
                </Text>
                <View style={styles.vencimentoContainer}>
                  <Text>
                    {calcularDiasParaVencimento(item.vencimento)} dias para o
                    vencimento do CMA
                  </Text>
                  {exibirAlerta(calcularDiasParaVencimento(item.vencimento))}
                </View>                
                <View style={styles.switchContainer}>
                  <Text>Notificações de Vencimento</Text>
                  <Switch
                   value={item.notificationsEnabled}
                   onValueChange={() => toggleNotifications(item, pessoas, setPessoas, salvarDados)}
                  />
                </View>
                <Text style={{fontSize: 10 }}>       
                </Text>
                <Button
                    title="Excluir ATCO"
                    onPress={() => excluirControlador(item)}
                  />
                  </Card.Content>
            </Card>
          </TouchableOpacity>
        );
      }}
      style={{ flex: 1 }}
    />

<View style={styles.footer}>
<Text style={styles.footerText}>
          Adicionar um novo ATCO
        </Text>
      </View>
            <FAB
        style={styles.fab}
        icon="plus"
        onPress={abrirModalNovoControlador}
      />
      {carregando && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#32CD32" />
        </View>
      )}


      {/* Modal de Edição */}
      <Modal visible={modalEdicaoVisible} animationType="slide"
      onRequestClose={() => setModalEdicaoVisible(false)}>
        <View style={styles.modalContainer}>
          
          <TextInput
            style={styles.input}
            value={nomeEditado}
            onChangeText={(text) => setNomeEditado(text)}
            placeholder="Nome"
          />
         <TextInput
  style={styles.input}
  value={lpnaEditado}
  onChangeText={(text) => setLpnaEditado(text)}
  placeholder="LPNA"
  keyboardType="numeric" // Adiciona o teclado numérico
/>
          <Text style={styles.modalText}>
            Selecione a data de vencimento do CMA:
          </Text>
          <Calendar
            onDayPress={(day) => {
              setVencimentoEditado(day.dateString);
              setDataSelecionada(day.dateString);
            }}
            markedDates={{
              [dataSelecionada]: { selected: true, selectedColor: 'blue' },
            }}
            date={vencimentoEditado}
          />
          <Button title="Salvar" onPress={salvarEdicao} />
          <Text style={{ fontSize: 4 }}></Text>
          <Button title="Cancelar" onPress={() => setModalEdicaoVisible(false)} />
        </View>
      </Modal>

      {/* Modal de Adição */}
      <Modal visible={modalAdicaoVisible} animationType="slide"
      onRequestClose={() => setModalAdicaoVisible(false)}>
      <View style={styles.modalContainer}>
          
          <TextInput
            style={styles.input}
            value={novoControlador.nome}
            onChangeText={(text) => setNovoControlador({ ...novoControlador, nome: text })}
            placeholder="Nome"
          />
          <TextInput
            style={styles.input}
            value={novoControlador.LPNA}
            onChangeText={(text) => setNovoControlador({ ...novoControlador, LPNA: text })}
            placeholder="LPNA"
            keyboardType="numeric" // Modificação: teclado numérico
          />
          <Text style={styles.modalText}>
            Selecione a data de vencimento do CMA:
          </Text>
          <Calendar
            onDayPress={(day) => {
              setNovoControlador({ ...novoControlador, vencimento: day.dateString });
              setDataSelecionada(day.dateString);
            }}
            markedDates={{
              [dataSelecionada]: { selected: true, selectedColor: 'blue' },
            }}
            date={novoControlador.vencimento}
          />
          <Button title="Salvar" onPress={adicionarNovoControlador} />
          <Text style={{ fontSize: 4 }}></Text>
          <Button title="Cancelar" onPress={() => setModalAdicaoVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Aplicativo de vencimento de CMA">
        <Stack.Screen name="Aplicativo de vencimento de CMA" component={HomeScreen} />
        <Stack.Screen name="Controladores" component={ControladoresDNVTScreen} />
        <Stack.Screen name="Sobre" component={SobreScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    paddingBottom: 7,
  },
  contentContainer: { 
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  card: {
    margin: 5,
    elevation: 3,
  },
  vencimentoContainer: {
    alignItems: 'flex-start',
    marginTop: 5,
  },
  alerta: {
    color: 'orange',
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 5,
  },
  vencido: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  fab: {
    position: 'absolute',
    margin: 10,
    right: 0,
    bottom: 0,
    backgroundColor: '#C0C0C0', // Cor de fundo
  },
  addButton: {
    backgroundColor: '#e0e0e0', // Cor de fundo
    borderRadius: 8, // Borda arredondada
    padding: 40,
  },
  customButton: {
    backgroundColor: '#6200ee', // Cor de fundo
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  customButtonText: {
    color: '#fff', // Cor do texto
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    alignItems: 'flex-start',
    padding: 20,
    borderTopWidth: 1, // Adiciona a borda superior
    borderTopColor: '#C0C0C0', // Cor da borda
  },
  footerText: {
    fontSize: 20,
    color: '#888',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo semi-transparente
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginEnd: 10
  },
  numeroAtcos: { 
    fontWeight: 'bold',
    fontSize: 18,
  },
  buscaInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
});