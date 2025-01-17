import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { StudyProgramService } from './studyProgram.service';
import { StudyProgramDTO } from './DTO';
import { response } from 'src/common/util/response';
import { IsAdmin } from 'src/common/decorator';

@Controller('prodi')
export class StudyProgramController {
  constructor(private readonly studyProgramService: StudyProgramService) {}

  @IsAdmin()
  @Post()
  async createStudyProgram(@Body() programDTO: StudyProgramDTO) {
    await this.studyProgramService.create(programDTO.name);
    return response('Successfully created a new study program');
  }

  @IsAdmin()
  @Patch('/:id')
  async updateStudyProgram(
    @Param('id') id: string,
    @Body() programDTO: StudyProgramDTO,
  ) {
    await this.studyProgramService.update(id, programDTO.name);
    return response('Successfully updated a study program');
  }
}
