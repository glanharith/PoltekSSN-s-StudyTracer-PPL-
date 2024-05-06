import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateSurveyDTO,
  EditSurveyDTO,
  ExistingQuestionDTO,
  QuestionDTO,
  SurveyDTO,
} from './DTO/SurveyDTO';
import { isUUID } from 'class-validator';
import { Alumni, Form } from '@prisma/client';
import { FillSurveyDTO } from './DTO/FIllSurveyDTO';
import { toCsvFile } from 'src/common/util/csv';

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  private validateFormDetails(form: SurveyDTO) {
    const {
      startTime,
      endTime,
      admissionYearFrom,
      admissionYearTo,
      graduateYearFrom,
      graduateYearTo,
    } = form;

    if (startTime.getTime() >= endTime.getTime()) {
      throw new BadRequestException({
        message: 'startTime must be before endTime',
      });
    }

    if (
      admissionYearFrom &&
      admissionYearTo &&
      admissionYearFrom > admissionYearTo
    ) {
      throw new BadRequestException({
        message: 'admissionYearFrom must be before admissionYearTo',
      });
    }

    if (
      graduateYearFrom &&
      graduateYearTo &&
      graduateYearFrom > graduateYearTo
    ) {
      throw new BadRequestException({
        message: 'graduateYearFrom must be before graduateYearTo',
      });
    }
  }

  private validateQuestionOrder = (questions: QuestionDTO[]) => {
    const questionOrderSet = new Set();

    questions.forEach((q) => {
      const { type, rangeFrom, rangeTo, options, order } = q;

      if (questionOrderSet.has(order)) {
        throw new BadRequestException({
          message: 'Question order must be unique within a form',
        });
      }

      questionOrderSet.add(order);

      if (['CHECKBOX', 'RADIO'].includes(type)) {
        if (options === undefined || options.length === 0) {
          throw new BadRequestException({
            message:
              'Question with type CHECKBOX or RADIO must have at least 1 option',
          });
        }

        const optionOrderSet = new Set();
        options.forEach(({ order: i }) => {
          if (optionOrderSet.has(i)) {
            throw new BadRequestException({
              message: 'Option order must be unique within a question',
            });
          }
          optionOrderSet.add(i);
        });
      }

      if (type === 'RANGE') {
        if (
          rangeFrom === undefined ||
          rangeTo === undefined ||
          rangeFrom > rangeTo
        ) {
          throw new BadRequestException({
            message:
              'Question with type RANGE must have rangeFrom and rangeTo, with rangeFrom less than or equal to rangeTo',
          });
        }
      }
    });
  };

  private async validateUpdatedQuestionOrder(
    newQuestions: QuestionDTO[],
    updateQuestions: ExistingQuestionDTO[],
  ) {
    const questionOrderSet = new Set(newQuestions.map(({ order }) => order));

    for (const q of updateQuestions) {
      try {
        const {
          type,
          rangeFrom,
          rangeTo,
          order,
          newOptions,
          updateOptions,
          deleteOptions,
        } = q;

        if (questionOrderSet.has(order)) {
          throw new BadRequestException({
            message: 'Question order must be unique within a form',
          });
        }

        if (type === 'RANGE') {
          if (
            rangeFrom === undefined ||
            rangeTo === undefined ||
            rangeFrom > rangeTo
          ) {
            throw new BadRequestException({
              message:
                'Question with type RANGE must have rangeFrom and rangeTo, with rangeFrom less than or equal to rangeTo',
            });
          }
        }

        if (['CHECKBOX', 'RADIO'].includes(type)) {
          if (
            (newOptions === undefined || newOptions.length === 0) &&
            (updateOptions === undefined || updateOptions.length === 0)
          ) {
            throw new BadRequestException({
              message:
                'Question with type CHECKBOX or RADIO must have at least 1 option when adding new options',
            });
          }

          const newOptionOrders = (newOptions ?? []).map(
            (option) => option.order,
          );
          const updateOptionOrders = (updateOptions ?? []).map(
            (option) => option.order,
          );
          const optionOrders = [...newOptionOrders, ...updateOptionOrders];
          const optionOrderSet = new Set();

          optionOrders.forEach((i) => {
            if (optionOrderSet.has(i)) {
              throw new BadRequestException({
                message: 'Option order must be unique within a question',
              });
            }
            optionOrderSet.add(i);
          });

          const existingOptions = await this.prisma.option.findMany({
            select: { id: true },
            where: { questionId: q.id },
          });
          const updateOptionIds = (updateOptions ?? []).map(
            (option) => option.id,
          );
          const deleteOptionIds = (deleteOptions ?? []).map(
            (option) => option.id,
          );
          const existingOptionIdSet = new Set(
            existingOptions.map((option) => option.id),
          );

          [...updateOptionIds, ...deleteOptionIds].forEach((optionId) => {
            if (!existingOptionIdSet.has(optionId)) {
              throw new BadRequestException({
                message: 'Failed to update or delete option: Option not found',
              });
            }
          });
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
  }

  async createSurvey(createSurveyDTO: CreateSurveyDTO) {
    const { questions, ...form } = createSurveyDTO;

    this.validateFormDetails(form);

    this.validateQuestionOrder(questions);

    await this.prisma.$transaction(async (tx) => {
      const { id } = await tx.form.create({
        data: {
          ...form,
        },
      });

      for (const q of questions) {
        const { options, ...question } = q;
        await tx.question.create({
          data: {
            ...question,
            formId: id,
            options: {
              createMany: {
                data: options ?? [],
              },
            },
          },
        });
      }
    });
  }

  async getSurveyForFill(surveyId: string, email: string) {
    if (!isUUID(surveyId)) {
      throw new BadRequestException(
        'Format ID tidak sesuai dengan format UUID',
      );
    }

    const user = await this.getUserByEmail(email);
    const alumni = await this.getAlumni(user);

    const survey = await this.prisma.form.findUnique({
      where: {
        id: surveyId,
      },
      include: {
        questions: {
          include: {
            options: {
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(
        `Survey dengan ID ${surveyId} tidak ditemukan`,
      );
    }

    this.validateFormTimeRange(survey);
    this.validateAlumniEnrollmentYear(alumni, survey);
    this.validateAlumniGraduateYear(alumni, survey);
    await this.checkExistingResponse(alumni, survey);

    return survey;
  }

  async editSurvey(id: string, editSurveyDTO: EditSurveyDTO) {
    const { newQuestions, updateQuestions, deleteQuestions, ...form } =
      editSurveyDTO;

    this.validateFormDetails(form);

    this.validateQuestionOrder(newQuestions);

    await this.validateUpdatedQuestionOrder(newQuestions, updateQuestions);

    const existingQuestions = await this.prisma.question.findMany({
      select: {
        id: true,
      },
      where: {
        formId: id,
      },
    });

    const existingQuestionIdSet = new Set(existingQuestions.map((q) => q.id));
    const updateQuestionIds = updateQuestions.map((q) => q.id);
    const deleteQuestionIds = deleteQuestions.map((q) => q.id);

    [...updateQuestionIds, ...deleteQuestionIds].forEach((q) => {
      if (!existingQuestionIdSet.has(q)) {
        throw new BadRequestException({
          message: 'Failed to update or delete question: Question not found',
        });
      }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.form.update({
        where: {
          id: id,
        },
        data: {
          ...form,
        },
      });

      for (const q of newQuestions) {
        const { options, ...question } = q;
        await tx.question.create({
          data: {
            ...question,
            formId: id,
            options: {
              createMany: {
                data: options ?? [],
              },
            },
          },
        });
      }

      for (const q of updateQuestions) {
        const { newOptions, updateOptions, deleteOptions, ...question } = q;

        await tx.question.update({
          where: {
            id: q.id,
          },
          data: {
            ...question,
            formId: id,
            options: {
              createMany: {
                data: newOptions ?? [],
              },
            },
          },
        });

        for (const opt of updateOptions ?? []) {
          const { id: optionId, label, order } = opt;
          await tx.option.update({
            where: {
              id: optionId,
            },
            data: {
              label,
              order,
            },
          });
        }

        const deleteOptionIds = (deleteOptions ?? []).map((opt) => opt.id);
        await tx.option.deleteMany({
          where: {
            id: {
              in: deleteOptionIds,
            },
          },
        });
      }

      await tx.question.deleteMany({
        where: {
          id: {
            in: deleteQuestionIds,
          },
        },
      });
    });
  }

  async deleteSurvey(id: string): Promise<string> {
    if (!isUUID(id)) {
      throw new BadRequestException(
        'Invalid ID format. ID must be a valid UUID',
      );
    }

    const survey = await this.prisma.form.findUnique({
      where: { id },
    });

    if (!survey) {
      throw new NotFoundException(`Survey with ID ${id} not found`);
    }

    const startTime = survey.startTime.getTime();
    const endTime = survey.endTime.getTime();
    const currentTime = new Date().getTime();

    if (currentTime >= startTime && currentTime <= endTime) {
      throw new BadRequestException(
        'Cannot delete survey during its active period',
      );
    }

    await this.prisma.form.delete({
      where: { id },
    });

    return id;
  }

  async getSurvey(id: string): Promise<Record<string, any>> {
    if (!isUUID(id)) {
      throw new BadRequestException(
        'Invalid ID format. ID must be a valid UUID',
      );
    }

    const survey = await this.prisma.form.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: {
            order: 'asc',
          },
          include: {
            options: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`Survey with ID ${id} not found`);
    }

    return survey;
  }

  async downloadSurveyResponses(id: string): Promise<Record<string, any>> {
    if (!isUUID(id)) {
      throw new BadRequestException(
        'Invalid ID format. ID must be a valid UUID',
      );
    }

    const survey = await this.prisma.form.findUnique({
      where: { id },
    });

    if (!survey) {
      throw new NotFoundException(`Survey with ID ${id} not found`);
    }

    const responses = await this.prisma.answer.findMany({
      select: {
        question: {
          select: {
            question: true,
          },
        },
        answer: true,
        response: {
          select: {
            alumni: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
                gender: true,
                enrollmentYear: true,
                graduateYear: true,
                npm: true,
                studyProgram: {
                  select: {
                    name: true,
                    code: true,
                    level: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        response: {
          formId: id,
        },
      },
    });

    if (responses.length == 0) {
      throw new BadRequestException(`Survey does not have any responses.`);
    }

    const flattenedData = responses.map((r) => {
      return {
        question: r.question.question,
        answer: r.answer,
        name: r.response.alumni.user.name,
        npm: r.response.alumni.npm,
        gender: r.response.alumni.gender,
        enrollmentYear: r.response.alumni.enrollmentYear,
        graduateYear: r.response.alumni.graduateYear,
        studyProgram: r.response.alumni.studyProgram.name,
        studyProgramCode: r.response.alumni.studyProgram.code,
        studyProgramLevel: r.response.alumni.studyProgram.level,
      };
    });

    return toCsvFile(flattenedData, `${survey.title}_Responses`);
  }

  async getAvailableSurveyByYear(
    admissionYear: string,
    graduateYear: string,
  ): Promise<Form[]> {
    const admissionYearNum = parseInt(admissionYear, 10);
    const graduateYearNum = parseInt(graduateYear, 10);

    if (isNaN(admissionYearNum) || isNaN(graduateYearNum)) {
      throw new BadRequestException('Invalid admission year or graduate year');
    }

    if (graduateYearNum < admissionYearNum) {
      throw new BadRequestException(
        "Graduate year can't be less than admission year",
      );
    }

    const today = new Date();
    const startDateThreshold = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000, // today + 7 days
    );

    return await this.prisma.form.findMany({
      where: {
        AND: [
          {
            OR: [
              { admissionYearFrom: { equals: null } },
              { admissionYearFrom: { lte: admissionYearNum } },
            ],
          },
          {
            OR: [
              { admissionYearTo: { equals: null } },
              { admissionYearTo: { gte: admissionYearNum } },
            ],
          },
          {
            OR: [
              { graduateYearFrom: { equals: null } },
              { graduateYearFrom: { lte: graduateYearNum } },
            ],
          },
          {
            OR: [
              { graduateYearTo: { equals: null } },
              { graduateYearTo: { gte: graduateYearNum } },
            ],
          },
          {
            AND: [
              { startTime: { lte: startDateThreshold } },
              { endTime: { gte: today } },
            ],
          },
        ],
      },
      include: {
        questions: false,
        responses: true,
      },
    });
  }

  async getAllSurveys(): Promise<Form[]> {
    return await this.prisma.form.findMany({
      include: {
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });
  }

  async fillSurvey(req: FillSurveyDTO, email: string) {
    const firstQuestionId = Object.keys(req)[0];
    const user = await this.getUserByEmail(email);
    const alumni = await this.getAlumni(user);
    const form = await this.getForm(firstQuestionId);

    this.validateFormTimeRange(form);
    this.validateAlumniEnrollmentYear(alumni, form);
    this.validateAlumniGraduateYear(alumni, form);
    await this.checkExistingResponse(alumni, form);

    await this.createResponseAndAnswers(req, alumni, form);
  }

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { alumni: true },
    });

    if (!user) {
      throw new NotFoundException(`User dengan email ${email} tidak ditemukan`);
    }

    return user;
  }

  async getAlumni(user: any) {
    const alumniId = user?.alumni?.id;

    if (!alumniId) {
      throw new NotFoundException(
        `User dengan id ${user.id} tidak memiliki role alumni`,
      );
    }

    const alumni = await this.prisma.alumni.findUnique({
      where: { id: alumniId },
      include: { studyProgram: true, responses: true },
    });

    if (!alumni) {
      throw new NotFoundException(`Alumni tidak ditemukan`);
    }

    return alumni;
  }

  async getForm(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(
        `Pertanyaan dengan id ${questionId} tidak ditemukan`,
      );
    }

    const form = await this.prisma.form.findUnique({
      where: { id: question.formId },
    });

    if (!form) {
      throw new NotFoundException(`Survey tidak ditemukan`);
    }

    return form;
  }

  private validateFormTimeRange(form: Form) {
    const currentTime = new Date();
    if (currentTime < form.startTime || currentTime > form.endTime) {
      throw new BadRequestException('Survey tidak dapat diisi pada saat ini.');
    }
  }

  private validateAlumniEnrollmentYear(alumni: Alumni, form: Form) {
    if (
      (form.admissionYearFrom !== undefined ||
        form.admissionYearTo !== undefined) &&
      !(
        alumni.enrollmentYear >= (form.admissionYearFrom || 0) &&
        alumni.enrollmentYear <=
          (form.admissionYearTo || new Date().getFullYear())
      )
    ) {
      throw new BadRequestException(
        'Tahun masuk alumni harus sesuai dengan syarat yang ditentukan.',
      );
    }
  }

  private validateAlumniGraduateYear(alumni: Alumni, form: Form) {
    if (
      (form.graduateYearFrom !== undefined ||
        form.graduateYearTo !== undefined) &&
      alumni.graduateYear !== undefined &&
      !(
        alumni.graduateYear >= (form.graduateYearFrom || 0) &&
        alumni.graduateYear <= (form.graduateYearTo || new Date().getFullYear())
      )
    ) {
      throw new BadRequestException(
        'Tahun kelulusan alumni harus sesuai dengan syarat yang ditentukan',
      );
    }
  }

  private async checkExistingResponse(alumni: Alumni, form: Form) {
    const response = await this.prisma.response.findFirst({
      where: { alumniId: alumni.id, formId: form.id },
    });

    if (response) {
      throw new BadRequestException(
        'Alumni hanya dapat mengisi survey satu kali',
      );
    }
  }

  private async createResponseAndAnswers(
    req: FillSurveyDTO,
    alumni: Alumni,
    form: Form,
  ) {
    await this.prisma.$transaction(async (prisma) => {
      const response = await prisma.response.create({
        data: {
          alumni: { connect: { id: alumni?.id } },
          form: { connect: { id: form?.id } },
        },
      });

      await Promise.all(
        Object.entries(req).map(async ([questionId, answer]) => {
          const answers = Array.isArray(answer) ? answer : [answer];
          await Promise.all(
            answers.map(async (item) => {
              await prisma.answer.create({
                data: {
                  answer: item.toString(),
                  response: { connect: { id: response.id } },
                  question: { connect: { id: questionId } },
                },
              });
            }),
          );
        }),
      );
    });
  }

  async getSurveyResponseByQuestions(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException(
        'Format ID tidak valid. ID harus dalam format UUID',
      );
    }

    const survey = await this.prisma.form.findUnique({
      where: { id },
      select: {
        title: true,
        questions: {
          orderBy: {
            order: 'asc',
          },
          select: {
            options: {
              orderBy: {
                order: 'asc',
              },
            },
            answers: true,
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`Survei dengan ID ${id} tidak ditemukan`);
    }

    const allQuestionsAnswered = survey.questions.every(
      (question) => question.answers && question.answers.length > 0,
    );

    if (!allQuestionsAnswered) {
      return { survey: survey, message: 'Survei tidak memiliki respon' };
    }

    const answers = survey.questions[0]?.answers ?? [];
    if (answers.length === 0) {
      throw new NotFoundException('Survei belum memiliki pertanyaan');
    }

    const totalRespondents = new Set(answers.map((answer) => answer.responseId))
      .size;
    const answerStats = this.analyzeResponse(survey, totalRespondents);

    return {
      title: survey.title,
      totalRespondents: totalRespondents,
      answerStats: answerStats,
    };
  }

  async analyzeResponse(survey: any, totalRespondents: number) {
    return survey.questions.map((question) => {
      const { type, options, answers } = question;

      if (type == 'TEXT') {
        return {
          question: question.question,
          questionType: type,
          data: answers.map((answer) => answer.answer),
        };
      } else {
        const optionStats = options.map((option) => {
          const optionAnswersCount = option.answers.length;
          const percentage = (optionAnswersCount / totalRespondents) * 100;
          return {
            optionLabel: option.label,
            optionAnswersCount,
            percentage: percentage.toFixed(2) + '%',
          };
        });

        return {
          question: question.question,
          questionType: type,
          data: optionStats,
        };
      }
    });
  }

  async getSurveyResponseByAlumni(id: string, email: string) {
    if (!isUUID(id)) {
      throw new BadRequestException(
        'Format ID tidak valid. ID harus dalam format UUID',
      );
    }

    // check the user. if user is admin then we need all the alumni response. but if user is head of study program, then we ONLY TAKE the alumi within its study program
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        admin: true,
        headStudyProgram: {
          include: {
            studyProgram: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let userStudyProgramId: string = '';

    if (user.role === 'HEAD_STUDY_PROGRAM') {
      userStudyProgramId = user?.headStudyProgram?.studyProgram.id ?? '';
    }

    const survey = await this.prisma.form.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: true,
            answers: {
              include: {
                response: {
                  include: {
                    alumni: {
                      select: {
                        npm: true,
                        enrollmentYear: true,
                        graduateYear: true,
                        studyProgramId: true,
                        user: { select: { name: true } },
                        studyProgram: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`Survey dengan ID ${id} tidak ditemukan`);
    }

    // Filter out responses where the alumni's study program doesn't match the user's study program
    const filteredQuestions = survey.questions.map((question) => ({
      ...question,
      answers: question.answers.filter(
        (answer) =>
          answer.response.alumni.studyProgramId === userStudyProgramId,
      ),
    }));

    survey.questions = filteredQuestions;

    const transformedData: any = {
      id: survey.id,
      type: survey.type,
      title: survey.title,
      description: survey.description,
      startTime: survey.startTime,
      endTime: survey.endTime,
      admissionYearFrom: survey.admissionYearFrom,
      admissionYearTo: survey.admissionYearTo,
      graduateYearFrom: survey.graduateYearFrom,
      graduateYearTo: survey.graduateYearTo,
      questions: survey.questions.map((question) => ({
        id: question.id,
        type: question.type,
        question: question.question,
        rangeFrom: question.rangeFrom,
        rangeTo: question.rangeTo,
        order: question.order,
        formId: question.formId,
        options: question.options ? question.options.map((option) => ({
          id: option.id,
          label: option.label,
          questionId: option.questionId,
          order: option.order,
        })) : [],
      })),
      alumniResponse: this.constructAlumniResponses(survey.questions),
    };

    return transformedData;
  }

  private constructAlumniResponses(questions: any[]): any[] {
    const alumniResponseMap = new Map<string, any[]>();

    questions.forEach((question) => {
      question.answers.forEach((answer) => {
        const alumniId = answer.response.alumniId;
        const alumniResponse = alumniResponseMap.get(alumniId) || [];

        const existingAlumniIndex = alumniResponse.findIndex(
          (entry) => entry.alumniId === alumniId,
        );

        if (existingAlumniIndex === -1) {
          alumniResponse.push({
            alumniId,
            npm: answer.response.alumni.npm,
            enrollmentYear: answer.response.alumni.enrollmentYear,
            graduateYear: answer.response.alumni.graduateYear,
            studyProgramId: answer.response.alumni.studyProgramId,
            name: answer.response.alumni.user.name,
            studyProgramName: answer.response.alumni.studyProgram.name,
            answers: [
              {
                questionId: answer.questionId,
                answer: answer.answer,
              },
            ],
          });
        } else {
          alumniResponse[existingAlumniIndex].answers.push({
            questionId: answer.questionId,
            answer: answer.answer,
          });
        }

        alumniResponseMap.set(alumniId, alumniResponse);
      });
    });

    return Array.from(alumniResponseMap.values()).flat();
  }
}
